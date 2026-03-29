import { Router, Response, Request } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createTacheSchema, updateTacheSchema } from '../schemas/tache.schema.js';
import { createActiviteSchema } from '../schemas/activite.schema.js';

type TacheRequest = Request<{ projetId: string; id?: string }>;

const router = Router({ mergeParams: true });
router.use(authenticate);

const TACHE_INCLUDE = {
  categorie: true,
  ressources: { include: { ressource: { select: { id: true, nom: true, email: true } } } },
  dependances: { include: { precedent: { select: { id: true, titre: true } } } },
};

// GET /projets/:projetId/taches
router.get('/', async (req: TacheRequest, res: Response): Promise<void> => {
  const taches = await prisma.tache.findMany({
    where: { projetId: req.params.projetId },
    include: TACHE_INCLUDE,
  });
  res.json(taches);
});

// POST /projets/:projetId/taches — responsable uniquement
router.post('/', requireRole('responsable'), validate(createTacheSchema), async (req: TacheRequest, res: Response): Promise<void> => {
  const projet = await prisma.projet.findUnique({ where: { id: req.params.projetId } });
  if (!projet) { res.status(404).json({ message: 'Projet introuvable' }); return; }

  const { ressourceIds, ...data } = req.body;

  const tache = await prisma.tache.create({
    data: {
      ...data,
      projetId: req.params.projetId,
      ressources: ressourceIds?.length
        ? { create: ressourceIds.map((id: string) => ({ ressourceId: id })) }
        : undefined,
    },
    include: TACHE_INCLUDE,
  });
  res.status(201).json(tache);
});

// PATCH /projets/:projetId/taches/:id — responsable uniquement
router.patch('/:id', requireRole('responsable'), validate(updateTacheSchema), async (req: TacheRequest, res: Response): Promise<void> => {
  const existing = await prisma.tache.findFirst({
    where: { id: req.params.id, projetId: req.params.projetId },
  });
  if (!existing) { res.status(404).json({ message: 'Tâche introuvable' }); return; }

  const { ressourceIds, ...data } = req.body;

  const tache = await prisma.tache.update({
    where: { id: req.params.id },
    data: {
      ...data,
      ressources: ressourceIds !== undefined
        ? {
            deleteMany: {},
            create: ressourceIds.map((id: string) => ({ ressourceId: id })),
          }
        : undefined,
    },
    include: TACHE_INCLUDE,
  });
  res.json(tache);
});

// DELETE /projets/:projetId/taches/:id — responsable uniquement
router.delete('/:id', requireRole('responsable'), async (req: TacheRequest, res: Response): Promise<void> => {
  const existing = await prisma.tache.findFirst({
    where: { id: req.params.id, projetId: req.params.projetId },
  });
  if (!existing) { res.status(404).json({ message: 'Tâche introuvable' }); return; }

  await prisma.tache.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// POST /projets/:projetId/taches/:id/dependances — ajouter un précédent
router.post('/:id/dependances', requireRole('responsable'), async (req: Request<{ projetId: string; id: string }>, res: Response): Promise<void> => {
  const { precedentId } = req.body;
  const { projetId, id: tacheId } = req.params;

  if (!precedentId || tacheId === precedentId) {
    res.status(400).json({ message: 'precedentId invalide' });
    return;
  }

  // Vérifie que les deux tâches appartiennent au même projet
  const [tache, precedent] = await Promise.all([
    prisma.tache.findFirst({ where: { id: tacheId, projetId } }),
    prisma.tache.findFirst({ where: { id: precedentId, projetId } }),
  ]);
  if (!tache || !precedent) {
    res.status(404).json({ message: 'Tâche introuvable dans ce projet' });
    return;
  }

  // Détection de cycle : le précédent ne doit pas (transitivement) dépendre de la tâche
  const hasCycle = await wouldCreateCycle(tacheId, precedentId);
  if (hasCycle) {
    res.status(400).json({ message: 'Cette dépendance crée un cycle' });
    return;
  }

  await prisma.tacheDependance.upsert({
    where: { tacheId_precedentId: { tacheId, precedentId } },
    create: { tacheId, precedentId },
    update: {},
  });
  res.status(201).json({ message: 'Dépendance ajoutée' });
});

// DELETE /projets/:projetId/taches/:id/dependances/:precedentId — supprimer un précédent
router.delete('/:id/dependances/:precedentId', requireRole('responsable'), async (req: Request<{ projetId: string; id: string; precedentId: string }>, res: Response): Promise<void> => {
  const { id: tacheId, precedentId } = req.params;
  await prisma.tacheDependance.deleteMany({ where: { tacheId, precedentId } });
  res.status(204).send();
});

// GET /projets/:projetId/taches/:id/activites
router.get('/:id/activites', async (req: TacheRequest, res: Response): Promise<void> => {
  const tache = await prisma.tache.findFirst({ where: { id: req.params.id, projetId: req.params.projetId } });
  if (!tache) { res.status(404).json({ message: 'Tâche introuvable' }); return; }

  const activites = await prisma.activite.findMany({
    where: { tacheId: req.params.id },
    include: { ressource: { select: { id: true, nom: true, email: true } } },
    orderBy: { date: 'desc' },
  });
  res.json(activites);
});

// POST /projets/:projetId/taches/:id/activites — responsable uniquement
router.post('/:id/activites', requireRole('responsable'), validate(createActiviteSchema), async (req: TacheRequest, res: Response): Promise<void> => {
  const tache = await prisma.tache.findFirst({ where: { id: req.params.id, projetId: req.params.projetId } });
  if (!tache) { res.status(404).json({ message: 'Tâche introuvable' }); return; }

  const ressource = await prisma.ressource.findUnique({ where: { id: req.body.ressourceId } });
  if (!ressource) { res.status(404).json({ message: 'Ressource introuvable' }); return; }

  const { tacheId: _, ...data } = req.body;
  const activite = await prisma.activite.create({
    data: { ...data, tacheId: req.params.id },
    include: { ressource: { select: { id: true, nom: true, email: true } } },
  });
  res.status(201).json(activite);
});

// DELETE /projets/:projetId/taches/:id/activites/:activiteId — responsable uniquement
router.delete('/:id/activites/:activiteId', requireRole('responsable'), async (req: Request<{ projetId: string; id: string; activiteId: string }>, res: Response): Promise<void> => {
  const existing = await prisma.activite.findFirst({ where: { id: req.params.activiteId, tacheId: req.params.id } });
  if (!existing) { res.status(404).json({ message: 'Activité introuvable' }); return; }

  await prisma.activite.delete({ where: { id: req.params.activiteId } });
  res.status(204).send();
});

async function wouldCreateCycle(tacheId: string, precedentId: string): Promise<boolean> {
  const visited = new Set<string>();
  const queue = [precedentId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const deps = await prisma.tacheDependance.findMany({ where: { tacheId: current } });
    for (const dep of deps) {
      if (dep.precedentId === tacheId) return true;
      queue.push(dep.precedentId);
    }
  }
  return false;
}

export default router;
