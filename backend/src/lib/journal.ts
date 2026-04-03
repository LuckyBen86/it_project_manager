import { ActionType } from '@prisma/client';
import prisma from './prisma.js';

export { ActionType };

export async function logAction(params: {
  auteurId: string;
  action: ActionType;
  entityId: string;
  entityTitre: string;
  ancienneValeur?: string | null;
  nouvelleValeur?: string | null;
}): Promise<void> {
  const auteur = await prisma.ressource.findUnique({
    where: { id: params.auteurId },
    select: { nom: true },
  });
  await prisma.journalAction.create({
    data: {
      action: params.action,
      auteurId: params.auteurId,
      auteurNom: auteur?.nom ?? 'Inconnu',
      entityId: params.entityId,
      entityTitre: params.entityTitre,
      ancienneValeur: params.ancienneValeur ?? null,
      nouvelleValeur: params.nouvelleValeur ?? null,
    },
  });
}
