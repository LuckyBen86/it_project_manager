import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createTagSchema, updateTagSchema } from '../schemas/categorie.schema.js';

const router = Router();
router.use(authenticate);

const TAG_INCLUDE = { poles: { select: { pole: { select: { id: true, nom: true } } } } };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const flattenPoles = (t: any) => ({ ...t, poles: (t.poles ?? []).map((tp: any) => tp.pole) });

// GET /tags?type=projet|tache&poleId=...
router.get('/', async (req, res: Response): Promise<void> => {
  const type   = req.query.type   as 'projet' | 'tache' | undefined;
  const poleId = req.query.poleId as string | undefined;

  const tags = await prisma.tag.findMany({
    where: {
      ...(type ? { type } : {}),
      ...(poleId ? { OR: [{ poles: { none: {} } }, { poles: { some: { poleId } } }] } : {}),
    },
    orderBy: { nom: 'asc' },
    include: TAG_INCLUDE,
  });
  res.json(tags.map(flattenPoles));
});

// POST /tags — responsable ou direction_generale
router.post('/', requireRole('responsable', 'direction_generale'), validate(createTagSchema), async (req, res: Response): Promise<void> => {
  const existing = await prisma.tag.findUnique({
    where: { nom_type: { nom: req.body.nom, type: req.body.type } },
  });
  if (existing) { res.status(409).json({ message: 'Ce tag existe déjà' }); return; }

  const { poleIds, ...data } = req.body;
  const tag = await prisma.tag.create({
    data: {
      ...data,
      poles: poleIds?.length
        ? { create: poleIds.map((id: string) => ({ poleId: id })) }
        : undefined,
    },
    include: TAG_INCLUDE,
  });
  res.status(201).json(flattenPoles(tag));
});

// PATCH /tags/:id — responsable ou direction_generale
router.patch('/:id', requireRole('responsable', 'direction_generale'), validate(updateTagSchema), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const existing = await prisma.tag.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ message: 'Tag introuvable' }); return; }

  const { poleIds, ...data } = req.body;
  const tag = await prisma.tag.update({
    where: { id: req.params.id },
    data: {
      ...data,
      ...(poleIds !== undefined ? {
        poles: { deleteMany: {}, create: poleIds.map((id: string) => ({ poleId: id })) },
      } : {}),
    },
    include: TAG_INCLUDE,
  });
  res.json(flattenPoles(tag));
});

// DELETE /tags/:id — responsable ou direction_generale
router.delete('/:id', requireRole('responsable', 'direction_generale'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const existing = await prisma.tag.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ message: 'Tag introuvable' }); return; }

  await prisma.tag.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
