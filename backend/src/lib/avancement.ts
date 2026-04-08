import prisma from './prisma.js';

/**
 * Si avancementAutoTache = true, recalcule avancementTache depuis les activités
 * (durée consommée / durée tâche * 100, plafonné à 100) et met à jour la DB.
 * Enchaîne ensuite maybeRecalculerProjet.
 */
export async function maybeRecalculerTache(tacheId: string): Promise<void> {
  const tache = await prisma.tache.findUnique({
    where: { id: tacheId },
    select: {
      projetId: true,
      duree: true,
      avancementAutoTache: true,
      activites: { select: { duree: true } },
    },
  });
  if (!tache || !tache.avancementAutoTache) {
    // Auto désactivé : recalculer quand même le projet (la tâche peut avoir un avancement manuel)
    if (tache) await maybeRecalculerProjet(tache.projetId);
    return;
  }

  let avancement = 0;
  if (tache.duree && tache.duree > 0) {
    const consomme = tache.activites.reduce((s, a) => s + a.duree, 0);
    avancement = Math.min(100, Math.round((consomme / tache.duree) * 100));
  }

  await prisma.tache.update({
    where: { id: tacheId },
    data: { avancementTache: avancement },
  });

  await maybeRecalculerProjet(tache.projetId);
}

/**
 * Si avancementAutoProjet = true, recalcule avancementProjet comme moyenne
 * pondérée par la durée des tâches non supprimées. Met à jour la DB.
 * Les tâches sans durée sont exclues du calcul.
 */
export async function maybeRecalculerProjet(projetId: string): Promise<void> {
  const projet = await prisma.projet.findUnique({
    where: { id: projetId },
    select: { avancementAutoProjet: true },
  });
  if (!projet || !projet.avancementAutoProjet) return;

  const taches = await prisma.tache.findMany({
    where: { projetId, deletedAt: null },
    select: { avancementTache: true, duree: true },
  });

  const avecDuree = taches.filter((t) => t.duree && t.duree > 0);
  let avancement = 0;
  if (avecDuree.length > 0) {
    const totalDuree = avecDuree.reduce((s, t) => s + t.duree!, 0);
    const pondere = avecDuree.reduce((s, t) => s + t.avancementTache * t.duree!, 0);
    avancement = Math.round(pondere / totalDuree);
  }

  await prisma.projet.update({
    where: { id: projetId },
    data: { avancementProjet: avancement },
  });
}
