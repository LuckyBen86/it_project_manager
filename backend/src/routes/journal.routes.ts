import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('responsable'));

// GET /journal?limit=50&offset=0&action=...&auteur=...&entity=...&dateFrom=...&dateTo=...
router.get('/', async (req, res: Response): Promise<void> => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const action   = req.query.action   as string | undefined;
  const auteur   = req.query.auteur   as string | undefined;
  const entity   = req.query.entity   as string | undefined;
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo   = req.query.dateTo   as string | undefined;

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (auteur) where.auteurNom   = { contains: auteur, mode: 'insensitive' };
  if (entity) where.entityTitre = { contains: entity, mode: 'insensitive' };
  if (dateFrom || dateTo) {
    const range: Record<string, Date> = {};
    if (dateFrom) range.gte = new Date(dateFrom);
    if (dateTo)   range.lte = new Date(dateTo + 'T23:59:59.999Z');
    where.createdAt = range;
  }

  const [entries, total] = await Promise.all([
    prisma.journalAction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.journalAction.count({ where }),
  ]);

  res.json({ entries, total, limit, offset });
});

// DELETE /journal — purge toutes les entrées
router.delete('/', async (_req, res: Response): Promise<void> => {
  await prisma.journalAction.deleteMany({});
  res.status(204).send();
});

export default router;
