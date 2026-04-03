import { Router, Response, Request } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

// GET /mes-demandes — demandes de l'utilisateur (hors archivées)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const demandes = await prisma.demandeValidation.findMany({
    where: { auteurId: req.user!.sub, archivedByAuteur: false },
    include: {
      tache: { select: { id: true, titre: true, projetId: true, duree: true, dateDebut: true, projet: { select: { id: true, titre: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(demandes);
});

// GET /mes-demandes/count — nombre de demandes refusées non archivées (badge)
router.get('/count', async (req: AuthRequest, res: Response): Promise<void> => {
  const count = await prisma.demandeValidation.count({
    where: { auteurId: req.user!.sub, statut: 'refuse', archivedByAuteur: false },
  });
  res.json({ count });
});

// PATCH /mes-demandes/:id/archiver
router.patch('/:id/archiver', async (req: AuthRequest & Request<{ id: string }>, res: Response): Promise<void> => {
  const demande = await prisma.demandeValidation.findFirst({
    where: { id: req.params.id, auteurId: req.user!.sub },
  });
  if (!demande) { res.status(404).json({ message: 'Demande introuvable' }); return; }
  if (demande.statut === 'en_attente') { res.status(400).json({ message: 'Impossible d\'archiver une demande en attente' }); return; }

  await prisma.demandeValidation.update({
    where: { id: req.params.id },
    data: { archivedByAuteur: true },
  });
  res.json({ message: 'Demande archivée' });
});

export default router;
