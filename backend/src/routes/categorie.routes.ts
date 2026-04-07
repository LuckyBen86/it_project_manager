import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createCategorieSchema, updateCategorieSchema } from '../schemas/categorie-projet.schema.js';

const router = Router();
router.use(authenticate);

const CATEGORIE_INCLUDE = { poles: { select: { pole: { select: { id: true, nom: true } } } } };
const flattenPoles = (c: any) => ({ ...c, poles: (c.poles ?? []).map((cp: any) => cp.pole) });

// GET /categories?poleId=...
router.get('/', async (req, res: Response): Promise<void> => {
  const poleId = req.query.poleId as string | undefined;

  const categories = await prisma.categorie.findMany({
    where: poleId
      ? { OR: [{ poles: { none: {} } }, { poles: { some: { poleId } } }] }
      : undefined,
    orderBy: { nom: 'asc' },
    include: CATEGORIE_INCLUDE,
  });
  res.json(categories.map(flattenPoles));
});

// POST /categories — responsable ou direction_generale
router.post('/', requireRole('responsable', 'direction_generale'), validate(createCategorieSchema), async (req, res: Response): Promise<void> => {
  const existing = await prisma.categorie.findUnique({ where: { nom: req.body.nom } });
  if (existing) { res.status(409).json({ message: 'Cette catégorie existe déjà' }); return; }

  const { poleIds, ...data } = req.body;
  const categorie = await prisma.categorie.create({
    data: {
      ...data,
      poles: poleIds?.length
        ? { create: poleIds.map((id: string) => ({ poleId: id })) }
        : undefined,
    },
    include: CATEGORIE_INCLUDE,
  });
  res.status(201).json(flattenPoles(categorie));
});

// PATCH /categories/:id
router.patch('/:id', requireRole('responsable', 'direction_generale'), validate(updateCategorieSchema), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const existing = await prisma.categorie.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ message: 'Catégorie introuvable' }); return; }

  const { poleIds, ...data } = req.body;
  const categorie = await prisma.categorie.update({
    where: { id: req.params.id },
    data: {
      ...data,
      ...(poleIds !== undefined ? {
        poles: { deleteMany: {}, create: poleIds.map((id: string) => ({ poleId: id })) },
      } : {}),
    },
    include: CATEGORIE_INCLUDE,
  });
  res.json(flattenPoles(categorie));
});

// DELETE /categories/:id
router.delete('/:id', requireRole('responsable', 'direction_generale'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const existing = await prisma.categorie.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ message: 'Catégorie introuvable' }); return; }

  await prisma.categorie.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
