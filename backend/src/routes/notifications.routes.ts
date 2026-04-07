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

// GET /notifications
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { sub: userId, role, responsablePoleIds } = req.user!;
  const isManager = role === 'responsable' || role === 'direction_generale';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7Days = new Date(today);
  in7Days.setDate(today.getDate() + 7);
  in7Days.setHours(23, 59, 59, 999);

  // Scope projet selon le rôle
  const projetWhere =
    role === 'direction_generale'
      ? { deletedAt: null }
      : role === 'responsable'
        ? { deletedAt: null, poleId: { in: responsablePoleIds ?? [] } }
        : {
            deletedAt: null,
            OR: [
              { taches: { some: { deletedAt: null, ressources: { some: { ressourceId: userId } } } } },
              { referentId: userId },
            ],
          };

  // Tâches non terminées avec dateDebut + duree ou dateButoire
  const tacheWhere =
    role === 'utilisateur'
      ? { deletedAt: null, statut: { not: 'termine' as const }, ressources: { some: { ressourceId: userId } } }
      : { deletedAt: null, statut: { not: 'termine' as const }, projet: projetWhere };

  const taches = await prisma.tache.findMany({
    where: { ...tacheWhere, OR: [{ dateDebut: { not: null } }, { dateButoire: { not: null } }] },
    select: {
      id: true, titre: true, dateDebut: true, duree: true, dateButoire: true,
      projetId: true, projet: { select: { titre: true } },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = [];

  for (const t of taches) {
    // Retard : end date dépassée
    if (t.dateDebut && t.duree) {
      const endDate = addWorkingDays(new Date(t.dateDebut), t.duree);
      if (endDate < today) {
        items.push({ id: t.id, type: 'retard', titre: t.titre, projetId: t.projetId, projetTitre: t.projet.titre });
        continue; // ne pas aussi ajouter echeance_proche pour la même tâche
      }
    }
    // Échéance proche (dateButoire dans les 7 prochains jours)
    if (t.dateButoire) {
      const d = new Date(t.dateButoire);
      if (d >= today && d <= in7Days) {
        items.push({ id: t.id, type: 'echeance_proche', titre: t.titre, projetId: t.projetId, projetTitre: t.projet.titre, dateButoire: t.dateButoire });
      }
    }
  }

  // Demandes en attente (managers seulement)
  if (isManager) {
    const demandeWhere =
      role === 'direction_generale'
        ? { statut: 'en_attente' as const }
        : { statut: 'en_attente' as const, tache: { projet: { poleId: { in: responsablePoleIds ?? [] } } } };

    const count = await prisma.demandeValidation.count({ where: demandeWhere });
    if (count > 0) {
      items.push({ id: 'demandes', type: 'demande_en_attente', titre: `${count} demande${count > 1 ? 's' : ''} en attente de validation`, count });
    }
  }

  res.json({ count: items.length, items });
});

export default router;
