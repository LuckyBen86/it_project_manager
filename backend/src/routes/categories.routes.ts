import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createTagSchema, updateTagSchema } from '../schemas/categorie.schema.js';

const router = Router();
router.use(authenticate);

// GET /tags?type=projet|tache
router.get('/', async (req, res: Response): Promise<void> => {
  const type = req.query.type as 'projet' | 'tache' | undefined;
  const tags = await prisma.tag.findMany({
    where: type ? { type } : undefined,
    orderBy: { nom: 'asc' },
  });
  res.json(tags);
});

// POST /tags — responsable uniquement
router.post('/', requireRole('responsable'), validate(createTagSchema), async (req, res: Response): Promise<void> => {
  const existing = await prisma.tag.findUnique({
    where: { nom_type: { nom: req.body.nom, type: req.body.type } },
  });
  if (existing) { res.status(409).json({ message: 'Ce tag existe déjà' }); return; }

  const tag = await prisma.tag.create({ data: req.body });
  res.status(201).json(tag);
});

// PATCH /tags/:id — responsable uniquement
router.patch('/:id', requireRole('responsable'), validate(updateTagSchema), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const existing = await prisma.tag.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ message: 'Tag introuvable' }); return; }

  const tag = await prisma.tag.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(tag);
});

// DELETE /tags/:id — responsable uniquement
router.delete('/:id', requireRole('responsable'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const existing = await prisma.tag.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ message: 'Tag introuvable' }); return; }

  await prisma.tag.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
