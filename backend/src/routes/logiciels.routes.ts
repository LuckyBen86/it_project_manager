import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createLogicielSchema, updateLogicielSchema } from '../schemas/logiciel.schema.js';

const router = Router();
router.use(authenticate);

// GET /logiciels
router.get('/', async (_req, res: Response): Promise<void> => {
  const logiciels = await prisma.logiciel.findMany({ orderBy: { nom: 'asc' } });
  res.json(logiciels);
});

// POST /logiciels — responsable uniquement
router.post('/', requireRole('responsable'), validate(createLogicielSchema), async (req, res: Response): Promise<void> => {
  const existing = await prisma.logiciel.findUnique({ where: { nom: req.body.nom } });
  if (existing) { res.status(409).json({ message: 'Ce logiciel existe déjà' }); return; }

  const logiciel = await prisma.logiciel.create({ data: req.body });
  res.status(201).json(logiciel);
});

// PATCH /logiciels/:id — responsable uniquement
router.patch('/:id', requireRole('responsable'), validate(updateLogicielSchema), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const existing = await prisma.logiciel.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ message: 'Logiciel introuvable' }); return; }

  const logiciel = await prisma.logiciel.update({ where: { id: req.params.id }, data: req.body });
  res.json(logiciel);
});

// DELETE /logiciels/:id — responsable uniquement
router.delete('/:id', requireRole('responsable'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const existing = await prisma.logiciel.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ message: 'Logiciel introuvable' }); return; }

  await prisma.logiciel.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
