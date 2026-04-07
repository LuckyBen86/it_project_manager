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

  // Si l'activité est rattachée à une tâche, valider la date et préparer les transitions de statut
  let tache: { id: string; titre: string; statut: string; projetId: string; dateDebut: Date | null } | null = null;
  if (req.body.tacheId) {
    tache = await prisma.tache.findUnique({
      where: { id: req.body.tacheId },
      select: { id: true, titre: true, statut: true, projetId: true, dateDebut: true },
    });
    if (tache?.dateDebut && new Date(req.body.date) < new Date(tache.dateDebut)) {
      res.status(400).json({ message: 'La date de l\'activité ne peut pas être antérieure au début de la tâche' }); return;
    }
  }

  const activite = await prisma.activite.create({
    data: req.body,
    include: ACTIVITE_INCLUDE,
  });

  if (tache && req.body.duree > 0) {
    // Passer la tâche de "a_faire" à "en_cours"
    if (tache.statut === 'a_faire') {
      await prisma.tache.update({ where: { id: tache.id }, data: { statut: 'en_cours' } });
      await logAction({ auteurId: req.user!.sub, action: 'STATUT_TACHE', entityId: tache.id, entityTitre: tache.titre, ancienneValeur: STATUT_LABELS_FR['a_faire'], nouvelleValeur: STATUT_LABELS_FR['en_cours'] });
    }
    // Passer le projet de "planifie" à "en_cours"
    const projet = await prisma.projet.findUnique({ where: { id: tache.projetId }, select: { id: true, titre: true, statut: true } });
    if (projet?.statut === 'planifie') {
      await prisma.projet.update({ where: { id: projet.id }, data: { statut: 'en_cours' } });
      await logAction({ auteurId: req.user!.sub, action: 'STATUT_PROJET', entityId: projet.id, entityTitre: projet.titre, ancienneValeur: STATUT_LABELS_FR['planifie'], nouvelleValeur: STATUT_LABELS_FR['en_cours'] });
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
