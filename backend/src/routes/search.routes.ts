import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

function projetWhereForUser(userId: string, role: string, responsablePoleIds?: string[]) {
  if (role === 'direction_generale') return { deletedAt: null };
  if (role === 'responsable') return { deletedAt: null, poleId: { in: responsablePoleIds ?? [] } };
  return {
    deletedAt: null,
    OR: [
      { taches: { some: { deletedAt: null, ressources: { some: { ressourceId: userId } } } } },
      { referentId: userId },
    ],
  };
}

// GET /search?q=...
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const q = (req.query.q as string ?? '').trim();
  if (q.length < 2) { res.json({ projets: [], taches: [] }); return; }

  const { sub: userId, role, responsablePoleIds } = req.user!;
  const projetWhere = projetWhereForUser(userId, role, responsablePoleIds);
  const textFilter = { contains: q, mode: 'insensitive' as const };

  const [projets, taches] = await Promise.all([
    prisma.projet.findMany({
      where: { ...projetWhere, OR: [{ titre: textFilter }, { description: textFilter }] },
      select: { id: true, titre: true, statut: true, pole: { select: { id: true, nom: true } } },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.tache.findMany({
      where: {
        deletedAt: null,
        projet: projetWhere,
        OR: [{ titre: textFilter }, { description: textFilter }],
      },
      select: { id: true, titre: true, statut: true, projetId: true, projet: { select: { titre: true } } },
      take: 10,
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  res.json({
    projets,
    taches: taches.map((t) => ({ ...t, projetTitre: t.projet.titre, projet: undefined })),
  });
});

export default router;
