import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createRessourceSchema, updateRessourceSchema } from '../schemas/ressource.schema.js';

const router = Router();
router.use(authenticate);

const RESSOURCE_SELECT = {
  id: true, nom: true, email: true, role: true, createdAt: true,
  responsablePoles: { select: { pole: { select: { id: true, nom: true } } } },
  poles: { select: { pole: { select: { id: true, nom: true } } } },
};

// GET /ressources
router.get('/', async (_req, res: Response): Promise<void> => {
  const ressources = await prisma.ressource.findMany({ select: RESSOURCE_SELECT });
  res.json(ressources);
});

// POST /ressources — responsable ou direction_generale
router.post('/', requireRole('responsable', 'direction_generale'), validate(createRessourceSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  const { password, poleIds, responsablePoleIds, ...data } = req.body;
  const requesterRole = req.user!.role;
  const requesterPoleIds = req.user!.responsablePoleIds ?? [];

  const existing = await prisma.ressource.findUnique({ where: { email: data.email } });
  if (existing) { res.status(409).json({ message: 'Cet email est déjà utilisé' }); return; }

  // Responsable : ne peut assigner que ses propres pôles
  let resolvedPoleIds: string[] = poleIds ?? [];
  let resolvedResponsablePoleIds: string[] = responsablePoleIds ?? [];

  if (requesterRole === 'responsable') {
    if (!requesterPoleIds.length) { res.status(403).json({ message: 'Pôles de gestion non définis' }); return; }
    resolvedPoleIds = requesterPoleIds;
    resolvedResponsablePoleIds = []; // seul DG peut définir les pôles de gestion
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const ressource = await prisma.ressource.create({
    data: {
      ...data,
      passwordHash,
      poles: resolvedPoleIds.length
        ? { create: resolvedPoleIds.map((id: string) => ({ poleId: id })) }
        : undefined,
      responsablePoles: resolvedResponsablePoleIds.length
        ? { create: resolvedResponsablePoleIds.map((id: string) => ({ poleId: id })) }
        : undefined,
    },
    select: RESSOURCE_SELECT,
  });
  res.status(201).json(ressource);
});

// PATCH /ressources/:id — responsable ou direction_generale
router.patch('/:id', requireRole('responsable', 'direction_generale'), validate(updateRessourceSchema), async (req: AuthRequest & Request<{ id: string }>, res: Response): Promise<void> => {
  const existing = await prisma.ressource.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ message: 'Ressource introuvable' }); return; }

  const { password, poleIds, responsablePoleIds, ...data } = req.body;
  const requesterRole = req.user!.role;
  const requesterPoleIds = req.user!.responsablePoleIds ?? [];

  const updateData: Record<string, unknown> = { ...data };
  if (password) updateData.passwordHash = await bcrypt.hash(password, 12);

  const ressource = await prisma.ressource.update({
    where: { id: req.params.id },
    data: {
      ...updateData,
      ...(poleIds !== undefined ? {
        poles: {
          deleteMany: requesterRole === 'direction_generale'
            ? {}
            : { poleId: { notIn: requesterPoleIds } },
          create: (requesterRole === 'responsable'
            ? requesterPoleIds
            : poleIds as string[]
          ).map((id: string) => ({ poleId: id })),
        },
      } : {}),
      // Seul DG peut modifier les pôles de gestion
      ...(requesterRole === 'direction_generale' && responsablePoleIds !== undefined ? {
        responsablePoles: {
          deleteMany: {},
          create: (responsablePoleIds as string[]).map((id: string) => ({ poleId: id })),
        },
      } : {}),
    },
    select: RESSOURCE_SELECT,
  });
  res.json(ressource);
});

// DELETE /ressources/:id — responsable ou direction_generale
router.delete('/:id', requireRole('responsable', 'direction_generale'), async (req: AuthRequest & Request<{ id: string }>, res: Response): Promise<void> => {
  const existing = await prisma.ressource.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ message: 'Ressource introuvable' }); return; }

  await prisma.ressource.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
