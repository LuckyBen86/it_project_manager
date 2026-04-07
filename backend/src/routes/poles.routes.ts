import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

// GET /poles — liste tous les pôles (tous les rôles)
router.get('/', async (_req, res: Response): Promise<void> => {
  const poles = await prisma.pole.findMany({ orderBy: { nom: 'asc' } });
  res.json(poles);
});

// POST /poles — direction_generale uniquement
router.post('/', requireRole('direction_generale'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { nom } = req.body as { nom: string };
  if (!nom?.trim()) { res.status(400).json({ message: 'Nom requis' }); return; }

  const existing = await prisma.pole.findUnique({ where: { nom: nom.trim() } });
  if (existing) { res.status(409).json({ message: 'Ce pôle existe déjà' }); return; }

  const pole = await prisma.pole.create({ data: { nom: nom.trim() } });
  res.status(201).json(pole);
});

// PATCH /poles/:id — direction_generale uniquement
router.patch('/:id', requireRole('direction_generale'), async (req: AuthRequest & { params: { id: string } }, res: Response): Promise<void> => {
  const { nom } = req.body as { nom?: string };
  if (!nom?.trim()) { res.status(400).json({ message: 'Nom requis' }); return; }

  const pole = await prisma.pole.findUnique({ where: { id: req.params.id } });
  if (!pole) { res.status(404).json({ message: 'Pôle introuvable' }); return; }

  const updated = await prisma.pole.update({ where: { id: req.params.id }, data: { nom: nom.trim() } });
  res.json(updated);
});

// DELETE /poles/:id — direction_generale uniquement
router.delete('/:id', requireRole('direction_generale'), async (req: AuthRequest & { params: { id: string } }, res: Response): Promise<void> => {
  const pole = await prisma.pole.findUnique({ where: { id: req.params.id } });
  if (!pole) { res.status(404).json({ message: 'Pôle introuvable' }); return; }

  const projetCount = await prisma.projet.count({ where: { poleId: req.params.id, deletedAt: null } });
  if (projetCount > 0) {
    res.status(409).json({ message: 'Impossible de supprimer ce pôle : des projets y sont rattachés.' });
    return;
  }

  await prisma.pole.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
