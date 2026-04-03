import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

function addWorkingDays(from: Date, n: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { sub: userId, role, responsablePoleIds } = req.user!;
  const isDG = role === 'direction_generale';
  const isResponsable = role === 'responsable';
  const isManager = isResponsable || isDG;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in5Days = addWorkingDays(today, 5);
  in5Days.setHours(23, 59, 59, 999);

  // ── Tâches ──────────────────────────────────────────────────────────────────
  let tacheWhere: object;
  if (isDG) {
    tacheWhere = { deletedAt: null };
  } else if (isResponsable) {
    tacheWhere = { deletedAt: null, projet: { deletedAt: null, poleId: { in: responsablePoleIds ?? [] } } };
  } else {
    tacheWhere = { deletedAt: null, ressources: { some: { ressourceId: userId } } };
  }

  const taches = await prisma.tache.findMany({
    where: tacheWhere,
    select: {
      id: true,
      statut: true,
      duree: true,
      dateDebut: true,
      dateButoire: true,
      activites: { select: { duree: true } },
    },
  });

  const tachesEnCours = taches.filter((t) => t.statut === 'en_cours');
  const totalTaches = taches.length;
  const tachesTerminees = taches.filter((t) => t.statut === 'termine').length;
  const tachesAFaire = taches.filter((t) => t.statut === 'a_faire').length;

  const tachesEnDepassement = tachesEnCours.filter((t) => {
    if (!t.duree) return false;
    const cumul = t.activites.reduce((s, a) => s + a.duree, 0);
    return cumul > t.duree;
  }).length;

  const tachesEnRetard = tachesEnCours.filter((t) =>
    t.dateButoire && new Date(t.dateButoire) < today,
  ).length;

  const tachesProchaineEcheance = tachesEnCours.filter((t) =>
    t.dateButoire &&
    new Date(t.dateButoire) >= today &&
    new Date(t.dateButoire) <= in5Days,
  ).length;

  const tachesSansDonnees = taches.filter(
    (t) => t.statut !== 'termine' && !t.duree && !t.dateDebut,
  ).length;

  // ── Projets (responsable ou DG uniquement) ──────────────────────────────────
  let projetsStats = null;
  if (isManager) {
    const projetWhere = isDG
      ? { deletedAt: null }
      : { deletedAt: null, poleId: { in: responsablePoleIds ?? [] } };

    const projets = await prisma.projet.findMany({
      where: projetWhere,
      select: {
        id: true,
        statut: true,
        duree: true,
        dateButoire: true,
        taches: {
          where: { deletedAt: null },
          select: { activites: { select: { duree: true } } },
        },
      },
    });

    const projetsEnCours = projets.filter((p) => p.statut === 'en_cours');

    const projetsEnDepassement = projetsEnCours.filter((p) => {
      if (!p.duree) return false;
      const cumul = p.taches.flatMap((t) => t.activites).reduce((s, a) => s + a.duree, 0);
      return cumul > p.duree;
    }).length;

    const projetsEnRetard = projetsEnCours.filter((p) =>
      p.dateButoire && new Date(p.dateButoire) < today,
    ).length;

    const projetsProchaineEcheance = projetsEnCours.filter((p) =>
      p.dateButoire &&
      new Date(p.dateButoire) >= today &&
      new Date(p.dateButoire) <= in5Days,
    ).length;

    projetsStats = {
      total: projets.length,
      enCours: projetsEnCours.length,
      termine: projets.filter((p) => p.statut === 'termine').length,
      enDepassement: projetsEnDepassement,
      enRetard: projetsEnRetard,
      prochaineEcheance: projetsProchaineEcheance,
    };
  }

  // ── Demandes ─────────────────────────────────────────────────────────────────
  let demandesEnAttente: number;
  if (isDG) {
    demandesEnAttente = await prisma.demandeValidation.count({ where: { statut: 'en_attente' } });
  } else if (isResponsable) {
    demandesEnAttente = await prisma.demandeValidation.count({
      where: {
        statut: 'en_attente',
        tache: { projet: { deletedAt: null, poleId: { in: responsablePoleIds ?? [] } } },
      },
    });
  } else {
    demandesEnAttente = await prisma.demandeValidation.count({
      where: { auteurId: userId, statut: 'en_attente' },
    });
  }

  res.json({
    taches: {
      total: totalTaches,
      termine: tachesTerminees,
      enCours: tachesEnCours.length,
      aFaire: tachesAFaire,
      enDepassement: tachesEnDepassement,
      enRetard: tachesEnRetard,
      prochaineEcheance: tachesProchaineEcheance,
      sansDonnees: tachesSansDonnees,
    },
    projets: projetsStats,
    demandes: { enAttente: demandesEnAttente },
  });
});

export default router;
