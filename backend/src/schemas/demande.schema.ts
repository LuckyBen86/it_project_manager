import { z } from 'zod';

export const createDemandeSchema = z.object({
  type: z.enum(['terminer', 'modifier_duree', 'modifier_date_debut']),
  valeurDemandee: z.string().optional(),
});

export const traiterDemandeSchema = z.object({
  action: z.enum(['valider', 'refuser']),
  commentaireRefus: z.string().optional(),
});

export type CreateDemandeInput = z.infer<typeof createDemandeSchema>;
export type TraiterDemandeInput = z.infer<typeof traiterDemandeSchema>;
