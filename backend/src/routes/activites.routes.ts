import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createActiviteSchema, updateActiviteSchema } from '../schemas/activite.schema.js';
import { logAction } from '../lib/journal.js';
import { STATUT_LABELS_FR } from '../lib/labels.js';

const router = Router();
router.use(authenticate);

const ACTIVITE_INCLUDE = {
  ressource: { select: { id: true, nom: true, email: true } },
};

// GET /activites
router.get('/', async (_req, res: Response): Promise<void> => {
  const activites = await prisma.activite.findMany({
    include: ACTIVITE_INCLUDE,
    orderBy: { date: 'desc' },
  });
  res.json(activites);
});

// POST /activites — responsable uniquement
router.post('/', requireRole('responsable'), validate(createActiviteSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  const ressource = await prisma.ressource.findUnique({ where: { id: req.body.ressourceId } });
  if (!ressource) { res.status(404).json({ message: 'Ressource introuvable' }); return; }

  const activite = await prisma.activite.create({
    data: req.body,
    include: ACTIVITE_INCLUDE,
  });

  // Si l'activité est rattachée à une tâche avec du temps, passer le projet de "planifie" à "en_cours"
  if (req.body.tacheId && req.body.duree > 0) {
    const tache = await prisma.tache.findUnique({
      where: { id: req.body.tacheId },
      select: { projetId: true },
    });
    if (tache?.projetId) {
      const projet = await prisma.projet.findUnique({
        where: { id: tache.projetId },
        select: { id: true, titre: true, statut: true },
      });
      if (projet?.statut === 'planifie') {
        await prisma.projet.update({
          where: { id: projet.id },
          data: { statut: 'en_cours' },
        });
        await logAction({
          auteurId: req.user!.sub,
          action: 'STATUT_PROJET',
          entityId: projet.id,
          entityTitre: projet.titre,
          ancienneValeur: STATUT_LABELS_FR['planifie'],
          nouvelleValeur: STATUT_LABELS_FR['en_cours'],
        });
      }
    }
  }

  res.status(201).json(activite);
});

// PATCH /activites/:id — responsable uniquement
router.patch('/:id', requireRole('responsable'), validate(updateActiviteSchema), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const existing = await prisma.activite.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ message: 'Activité introuvable' }); return; }

  const activite = await prisma.activite.update({
    where: { id: req.params.id },
    data: req.body,
    include: ACTIVITE_INCLUDE,
  });
  res.json(activite);
});

// DELETE /activites/:id — responsable uniquement
router.delete('/:id', requireRole('responsable'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const existing = await prisma.activite.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ message: 'Activité introuvable' }); return; }

  await prisma.activite.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
