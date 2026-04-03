import { Router, Response, Request } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createTacheSchema, updateTacheSchema } from '../schemas/tache.schema.js';
import { createActiviteSchema } from '../schemas/activite.schema.js';
import { logAction } from '../lib/journal.js';
import { STATUT_LABELS_FR, formatDateFr } from '../lib/labels.js';

type TacheRequest = Request<{ projetId: string; id?: string }>;

const router = Router({ mergeParams: true });
router.use(authenticate);

const TACHE_INCLUDE = {
  tags: { select: { tag: true } },
  ressources: { include: { ressource: { select: { id: true, nom: true, email: true } } } },
  dependances: { include: { precedent: { select: { id: true, titre: true } } } },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const flattenTags = (t: any) => ({ ...t, tags: (t.tags ?? []).map((tt: any) => tt.tag) });

async function canWriteTache(userId: string, role: string, projetId: string): Promise<boolean> {
  if (role === 'responsable' || role === 'direction_generale') return true;
  const projet = await prisma.projet.findFirst({ where: { id: projetId, deletedAt: null, referentId: userId } });
  return !!projet;
}

// GET /projets/:projetId/taches
router.get('/', async (req: TacheRequest, res: Response): Promise<void> => {
  const taches = await prisma.tache.findMany({
    where: { projetId: req.params.projetId, deletedAt: null },
    include: TACHE_INCLUDE,
  });
  res.json(taches.map(flattenTags));
});

// POST /projets/:projetId/taches — responsable, direction_generale, ou référent du projet
router.post('/', validate(createTacheSchema), async (req: TacheRequest, res: Response): Promise<void> => {
  const { sub: userId, role } = (req as AuthRequest).user!;

  if (!await canWriteTache(userId, role, req.params.projetId)) {
    res.status(403).json({ message: 'Accès refusé : droits insuffisants' });
    return;
  }

  const projet = await prisma.projet.findFirst({ where: { id: req.params.projetId, deletedAt: null } });
  if (!projet) { res.status(404).json({ message: 'Projet introuvable' }); return; }

  if (req.body.dateDebut && projet.dateDebut && new Date(req.body.dateDebut) < projet.dateDebut) {
    res.status(400).json({ message: 'La date de début de la tâche ne peut pas être antérieure à celle du projet.' });
    return;
  }

  const { ressourceIds, tagIds, ...data } = req.body;

  const tache = await prisma.tache.create({
    data: {
      ...data,
      projetId: req.params.projetId,
      ressources: ressourceIds?.length
        ? { create: ressourceIds.map((id: string) => ({ ressourceId: id })) }
        : undefined,
      tags: tagIds?.length
        ? { create: tagIds.map((id: string) => ({ tagId: id })) }
        : undefined,
    },
    include: TACHE_INCLUDE,
  });
  res.status(201).json(flattenTags(tache));
});

// PATCH /projets/:projetId/taches/:id — responsable, direction_generale, ou référent du projet
router.patch('/:id', validate(updateTacheSchema), async (req: TacheRequest, res: Response): Promise<void> => {
  const { sub: userId, role } = (req as AuthRequest).user!;
  const auteurId = userId;

  if (!await canWriteTache(userId, role, req.params.projetId)) {
    res.status(403).json({ message: 'Accès refusé : droits insuffisants' });
    return;
  }

  const existing = await prisma.tache.findFirst({
    where: { id: req.params.id, projetId: req.params.projetId, deletedAt: null },
  });
  if (!existing) { res.status(404).json({ message: 'Tâche introuvable' }); return; }

  if (req.body.dateDebut !== undefined && req.body.dateDebut !== null) {
    const projet = await prisma.projet.findFirst({ where: { id: req.params.projetId, deletedAt: null } });
    if (projet?.dateDebut && new Date(req.body.dateDebut) < projet.dateDebut) {
      res.status(400).json({ message: 'La date de début de la tâche ne peut pas être antérieure à celle du projet.' });
      return;
    }
  }

  const { ressourceIds, tagIds, ...data } = req.body;

  const tache = await prisma.tache.update({
    where: { id: req.params.id },
    data: {
      ...data,
      ressources: ressourceIds !== undefined
        ? { deleteMany: {}, create: ressourceIds.map((id: string) => ({ ressourceId: id })) }
        : undefined,
      ...(tagIds !== undefined ? {
        tags: { deleteMany: {}, create: tagIds.map((id: string) => ({ tagId: id })) },
      } : {}),
    },
    include: TACHE_INCLUDE,
  });

  if (req.body.statut && req.body.statut !== existing.statut) {
    await logAction({
      auteurId,
      action: 'STATUT_TACHE',
      entityId: tache.id,
      entityTitre: tache.titre,
      ancienneValeur: STATUT_LABELS_FR[existing.statut] ?? existing.statut,
      nouvelleValeur: STATUT_LABELS_FR[req.body.statut] ?? req.body.statut,
    });
  }
  if (req.body.dateDebut !== undefined) {
    const ancien = existing.dateDebut?.toISOString() ?? null;
    const nouveau = req.body.dateDebut ?? null;
    if (ancien !== nouveau) {
      await logAction({
        auteurId,
        action: 'DATE_DEBUT_TACHE',
        entityId: tache.id,
        entityTitre: tache.titre,
        ancienneValeur: ancien ? formatDateFr(ancien) : null,
        nouvelleValeur: nouveau ? formatDateFr(nouveau) : null,
      });
    }
  }

  res.json(flattenTags(tache));
});

// DELETE /projets/:projetId/taches/:id — soft delete — responsable uniquement
router.delete('/:id', requireRole('responsable'), async (req: TacheRequest, res: Response): Promise<void> => {
  const auteurId = (req as AuthRequest).user!.sub;
  const existing = await prisma.tache.findFirst({
    where: { id: req.params.id, projetId: req.params.projetId, deletedAt: null },
  });
  if (!existing) { res.status(404).json({ message: 'Tâche introuvable' }); return; }

  // RG-TACHE-06 : interdiction si activités présentes
  const activiteCount = await prisma.activite.count({ where: { tacheId: req.params.id } });
  if (activiteCount > 0) {
    res.status(409).json({ message: 'Impossible de supprimer cette tâche : elle contient des activités de saisie.' });
    return;
  }

  await logAction({
    auteurId,
    action: 'SUPPRESSION_TACHE',
    entityId: existing.id,
    entityTitre: existing.titre,
  });

  await prisma.tache.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date(), deletedById: auteurId },
  });

  res.status(204).send();
});

// POST /projets/:projetId/taches/:id/dependances — responsable ou référent
router.post('/:id/dependances', async (req: Request<{ projetId: string; id: string }>, res: Response): Promise<void> => {
  const { sub: userId, role } = (req as AuthRequest).user!;

  if (!await canWriteTache(userId, role, req.params.projetId)) {
    res.status(403).json({ message: 'Accès refusé : droits insuffisants' });
    return;
  }

  const { precedentId } = req.body;
  const { projetId, id: tacheId } = req.params;

  if (!precedentId || tacheId === precedentId) {
    res.status(400).json({ message: 'precedentId invalide' });
    return;
  }

  const [tache, precedent] = await Promise.all([
    prisma.tache.findFirst({ where: { id: tacheId, projetId, deletedAt: null } }),
    prisma.tache.findFirst({ where: { id: precedentId, projetId, deletedAt: null } }),
  ]);
  if (!tache || !precedent) {
    res.status(404).json({ message: 'Tâche introuvable dans ce projet' });
    return;
  }

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

// DELETE /projets/:projetId/taches/:id/dependances/:precedentId — responsable ou référent
router.delete('/:id/dependances/:precedentId', async (req: Request<{ projetId: string; id: string; precedentId: string }>, res: Response): Promise<void> => {
  const { sub: userId, role } = (req as AuthRequest).user!;

  if (!await canWriteTache(userId, role, req.params.projetId)) {
    res.status(403).json({ message: 'Accès refusé : droits insuffisants' });
    return;
  }

  const { id: tacheId, precedentId } = req.params;
  await prisma.tacheDependance.deleteMany({ where: { tacheId, precedentId } });
  res.status(204).send();
});

// GET /projets/:projetId/taches/:id/activites
router.get('/:id/activites', async (req: TacheRequest, res: Response): Promise<void> => {
  const tache = await prisma.tache.findFirst({ where: { id: req.params.id, projetId: req.params.projetId, deletedAt: null } });
  if (!tache) { res.status(404).json({ message: 'Tâche introuvable' }); return; }

  const activites = await prisma.activite.findMany({
    where: { tacheId: req.params.id },
    include: { ressource: { select: { id: true, nom: true, email: true } } },
    orderBy: { date: 'desc' },
  });
  res.json(activites);
});

// POST /projets/:projetId/taches/:id/activites
router.post('/:id/activites', requireRole('responsable'), validate(createActiviteSchema), async (req: TacheRequest, res: Response): Promise<void> => {
  const auteurId = (req as AuthRequest).user!.sub;
  const tache = await prisma.tache.findFirst({ where: { id: req.params.id, projetId: req.params.projetId, deletedAt: null } });
  if (!tache) { res.status(404).json({ message: 'Tâche introuvable' }); return; }

  const ressource = await prisma.ressource.findUnique({ where: { id: req.body.ressourceId } });
  if (!ressource) { res.status(404).json({ message: 'Ressource introuvable' }); return; }

  const { tacheId: _, ...data } = req.body;
  const activite = await prisma.activite.create({
    data: { ...data, tacheId: req.params.id },
    include: { ressource: { select: { id: true, nom: true, email: true } } },
  });

  if (tache.statut === 'a_faire' && req.body.duree > 0) {
    await prisma.tache.update({ where: { id: req.params.id }, data: { statut: 'en_cours' } });
    await logAction({
      auteurId,
      action: 'STATUT_TACHE',
      entityId: tache.id,
      entityTitre: tache.titre,
      ancienneValeur: STATUT_LABELS_FR['a_faire'],
      nouvelleValeur: STATUT_LABELS_FR['en_cours'],
    });
  }

  res.status(201).json(activite);
});

// DELETE /projets/:projetId/taches/:id/activites/:activiteId
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
