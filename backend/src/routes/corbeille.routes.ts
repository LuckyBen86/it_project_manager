import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.middleware.js';
import { logAction } from '../lib/journal.js';

const router = Router();
router.use(authenticate);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const flattenTags = (obj: any) => ({ ...obj, tags: (obj.tags ?? []).map((pt: any) => pt.tag) });

const TACHE_CORBEILLE_INCLUDE = {
  projet: { select: { id: true, titre: true } },
  tags: { select: { tag: true } },
  activites: { select: { id: true } },
};

// GET /corbeille — éléments supprimés par l'utilisateur courant
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.sub;

  const [projets, taches] = await Promise.all([
    prisma.projet.findMany({
      where: { deletedById: userId, deletedAt: { not: null } },
      include: {
        tags: { select: { tag: true } },
        referent: { select: { id: true, nom: true } },
        taches: {
          where: { deletedWithProjetId: { not: null } },
          select: { id: true },
        },
      },
      orderBy: { deletedAt: 'desc' },
    }),
    // Tâches supprimées indépendamment (pas via un projet)
    prisma.tache.findMany({
      where: { deletedById: userId, deletedAt: { not: null }, deletedWithProjetId: null },
      include: TACHE_CORBEILLE_INCLUDE,
      orderBy: { deletedAt: 'desc' },
    }),
  ]);

  res.json({ projets: projets.map(flattenTags), taches: taches.map(flattenTags) });
});

// POST /corbeille/projets/:id/restaurer
router.post('/projets/:id/restaurer', async (req: AuthRequest & { params: { id: string } }, res: Response): Promise<void> => {
  const userId = req.user!.sub;
  const id = req.params.id as string;
  const projet = await prisma.projet.findFirst({
    where: { id, deletedById: userId, deletedAt: { not: null } },
  });
  if (!projet) { res.status(404).json({ message: 'Projet introuvable dans la corbeille' }); return; }

  await prisma.projet.update({
    where: { id },
    data: { deletedAt: null, deletedById: null },
  });

  await prisma.tache.updateMany({
    where: { deletedWithProjetId: id },
    data: { deletedAt: null, deletedById: null, deletedWithProjetId: null },
  });

  await logAction({
    auteurId: userId,
    action: 'RESTAURATION_PROJET',
    entityId: projet.id,
    entityTitre: projet.titre,
  });

  res.status(204).send();
});

// POST /corbeille/taches/:id/restaurer
router.post('/taches/:id/restaurer', async (req: AuthRequest & { params: { id: string } }, res: Response): Promise<void> => {
  const userId = req.user!.sub;
  const id = req.params.id as string;
  const tache = await prisma.tache.findFirst({
    where: { id, deletedById: userId, deletedAt: { not: null } },
  });
  if (!tache) { res.status(404).json({ message: 'Tâche introuvable dans la corbeille' }); return; }

  const projet = await prisma.projet.findFirst({ where: { id: tache.projetId, deletedAt: null } });
  if (!projet) {
    res.status(409).json({ message: 'Impossible de restaurer : le projet parent est supprimé. Restaurez d\'abord le projet.' });
    return;
  }

  await prisma.tache.update({
    where: { id },
    data: { deletedAt: null, deletedById: null, deletedWithProjetId: null },
  });

  await logAction({
    auteurId: userId,
    action: 'RESTAURATION_TACHE',
    entityId: tache.id,
    entityTitre: tache.titre,
  });

  res.status(204).send();
});

export default router;
