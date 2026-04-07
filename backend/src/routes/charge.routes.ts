import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

function isoMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// GET /charge?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { sub: userId, role, responsablePoleIds } = req.user!;

  const fromStr = req.query.from as string;
  const toStr   = req.query.to   as string;
  if (!fromStr || !toStr) { res.status(400).json({ message: 'Paramètres from et to requis' }); return; }

  const fromDate = new Date(fromStr);
  const toDate   = new Date(toStr);
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || fromDate > toDate) {
    res.status(400).json({ message: 'Paramètres from/to invalides' }); return;
  }

  // Construire liste des lundis entre from et to
  const weeks: string[] = [];
  let cursor = new Date(isoMonday(fromDate));
  const toMonday = new Date(isoMonday(toDate));
  while (cursor <= toMonday && weeks.length <= 52) {
    weeks.push(cursor.toISOString().slice(0, 10));
    cursor = addDays(cursor, 7);
  }

  const projetWhere =
    role === 'direction_generale'
      ? { deletedAt: null }
      : role === 'responsable'
        ? { deletedAt: null, poleId: { in: responsablePoleIds ?? [] } }
        : { deletedAt: null };

  // Récupérer toutes les assignations de tâches avec dateDebut + duree
  const assignments = await prisma.tacheRessource.findMany({
    where: {
      ...(role === 'utilisateur' ? { ressourceId: userId } : {}),
      tache: {
        deletedAt: null,
        dateDebut: { not: null },
        duree:     { not: null },
        projet: projetWhere,
      },
    },
    select: {
      ressourceId: true,
      ressource: { select: { id: true, nom: true } },
      tache: { select: { dateDebut: true, duree: true } },
    },
  });

  // Agréger par ressource et semaine
  const workloadMap = new Map<string, { nom: string; workload: Record<string, number> }>();

  for (const a of assignments) {
    const { ressourceId, ressource, tache } = a;
    if (!tache.dateDebut || !tache.duree) continue;

    if (!workloadMap.has(ressourceId)) {
      workloadMap.set(ressourceId, { nom: ressource.nom, workload: {} });
    }
    const row = workloadMap.get(ressourceId)!;

    // Itérer les jours ouvrés de la tâche et les répartir par semaine
    let current = new Date(tache.dateDebut);
    let added = 0;
    while (added < tache.duree) {
      if (!isWeekend(current)) {
        const weekKey = isoMonday(current);
        if (weeks.includes(weekKey)) {
          row.workload[weekKey] = (row.workload[weekKey] ?? 0) + 1;
        }
        added++;
      }
      current = addDays(current, 1);
    }
  }

  const rows = Array.from(workloadMap.entries())
    .map(([ressourceId, { nom, workload }]) => ({ ressourceId, ressourceNom: nom, workload }))
    .sort((a, b) => a.ressourceNom.localeCompare(b.ressourceNom));

  res.json({ weeks, rows });
});

export default router;
