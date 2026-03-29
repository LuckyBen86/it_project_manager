import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createProjetSchema,
  updateProjetSchema,
  updateGanttSchema,
} from '../schemas/projet.schema.js';

const router = Router();
router.use(authenticate);

const PROJET_INCLUDE = {
  responsable: { select: { id: true, nom: true, email: true } },
  categorie: true,
  taches: {
    include: {
      ressources: { include: { ressource: { select: { id: true, nom: true } } } },
      dependances: { include: { precedent: { select: { id: true, titre: true } } } },
    },
  },
};

// GET /projets
router.get('/', async (_req, res: Response): Promise<void> => {
  const projets = await prisma.projet.findMany({
    include: PROJET_INCLUDE,
    orderBy: { dateButoire: 'asc' },
  });
  res.json(projets);
});

// GET /projets/:id
router.get('/:id', async (req, res: Response): Promise<void> => {
  const projet = await prisma.projet.findUnique({
    where: { id: req.params.id },
    include: PROJET_INCLUDE,
  });
  if (!projet) { res.status(404).json({ message: 'Projet introuvable' }); return; }
  res.json(projet);
});

// POST /projets — responsable uniquement
router.post('/', requireRole('responsable'), validate(createProjetSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  const { ressourceIds: _, ...data } = req.body;
  const projet = await prisma.projet.create({
    data,
    include: PROJET_INCLUDE,
  });
  res.status(201).json(projet);
});

// PATCH /projets/:id — responsable uniquement
router.patch('/:id', requireRole('responsable'), validate(updateProjetSchema), async (req, res: Response): Promise<void> => {
  const existing = await prisma.projet.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ message: 'Projet introuvable' }); return; }

  const projet = await prisma.projet.update({
    where: { id: req.params.id },
    data: req.body,
    include: PROJET_INCLUDE,
  });
  res.json(projet);
});

// PATCH /projets/:id/gantt — déplace/redimensionne dans la vue Gantt (responsable)
router.patch('/:id/gantt', requireRole('responsable'), validate(updateGanttSchema), async (req, res: Response): Promise<void> => {
  const existing = await prisma.projet.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ message: 'Projet introuvable' }); return; }

  const projet = await prisma.projet.update({
    where: { id: req.params.id },
    data: req.body,
    include: PROJET_INCLUDE,
  });
  res.json(projet);
});

// DELETE /projets/:id — responsable uniquement (cascade tâches via Prisma schema)
router.delete('/:id', requireRole('responsable'), async (req, res: Response): Promise<void> => {
  const existing = await prisma.projet.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ message: 'Projet introuvable' }); return; }

  await prisma.projet.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
