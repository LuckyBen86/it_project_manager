import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createRessourceSchema, updateRessourceSchema } from '../schemas/ressource.schema.js';

const router = Router();
router.use(authenticate);

const RESSOURCE_SELECT = { id: true, nom: true, email: true, role: true, createdAt: true };

// GET /ressources
router.get('/', async (_req, res: Response): Promise<void> => {
  const ressources = await prisma.ressource.findMany({ select: RESSOURCE_SELECT });
  res.json(ressources);
});

// POST /ressources — responsable uniquement
router.post('/', requireRole('responsable'), validate(createRessourceSchema), async (req, res: Response): Promise<void> => {
  const { password, ...data } = req.body;

  const existing = await prisma.ressource.findUnique({ where: { email: data.email } });
  if (existing) { res.status(409).json({ message: 'Cet email est déjà utilisé' }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  const ressource = await prisma.ressource.create({
    data: { ...data, passwordHash },
    select: RESSOURCE_SELECT,
  });
  res.status(201).json(ressource);
});

// PATCH /ressources/:id — responsable uniquement
router.patch('/:id', requireRole('responsable'), validate(updateRessourceSchema), async (req, res: Response): Promise<void> => {
  const existing = await prisma.ressource.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ message: 'Ressource introuvable' }); return; }

  const { password, ...data } = req.body;
  const updateData: Record<string, unknown> = { ...data };

  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 12);
  }

  const ressource = await prisma.ressource.update({
    where: { id: req.params.id },
    data: updateData,
    select: RESSOURCE_SELECT,
  });
  res.json(ressource);
});

// DELETE /ressources/:id — responsable uniquement
router.delete('/:id', requireRole('responsable'), async (req, res: Response): Promise<void> => {
  const existing = await prisma.ressource.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ message: 'Ressource introuvable' }); return; }

  await prisma.ressource.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
