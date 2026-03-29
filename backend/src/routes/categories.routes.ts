import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createCategorieSchema, updateCategorieSchema } from '../schemas/categorie.schema.js';

const router = Router();
router.use(authenticate);

// GET /categories?type=projet|tache
router.get('/', async (req, res: Response): Promise<void> => {
  const type = req.query.type as 'projet' | 'tache' | undefined;
  const categories = await prisma.categorie.findMany({
    where: type ? { type } : undefined,
    orderBy: { nom: 'asc' },
  });
  res.json(categories);
});

// POST /categories — responsable uniquement
router.post('/', requireRole('responsable'), validate(createCategorieSchema), async (req, res: Response): Promise<void> => {
  const existing = await prisma.categorie.findUnique({
    where: { nom_type: { nom: req.body.nom, type: req.body.type } },
  });
  if (existing) { res.status(409).json({ message: 'Cette catégorie existe déjà' }); return; }

  const categorie = await prisma.categorie.create({ data: req.body });
  res.status(201).json(categorie);
});

// PATCH /categories/:id — responsable uniquement
router.patch('/:id', requireRole('responsable'), validate(updateCategorieSchema), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const existing = await prisma.categorie.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ message: 'Catégorie introuvable' }); return; }

  const categorie = await prisma.categorie.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(categorie);
});

// DELETE /categories/:id — responsable uniquement
router.delete('/:id', requireRole('responsable'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const existing = await prisma.categorie.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ message: 'Catégorie introuvable' }); return; }

  await prisma.categorie.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
