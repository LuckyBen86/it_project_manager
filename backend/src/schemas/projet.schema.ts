import { z } from 'zod';

export const createProjetSchema = z.object({
  titre: z.string().min(1, 'Titre requis').max(255),
  description: z.string().optional(),
  poleId: z.string().uuid('ID pôle invalide'),
  tagIds: z.array(z.string().uuid()).optional(),
  logicielIds: z.array(z.string().uuid()).optional(),
  referentId: z.string().uuid('ID référent invalide').optional(),
  dateButoire: z.string().datetime().optional(),
  dateDebut: z.string().datetime().optional(),
  duree: z.number().int().positive().optional(),
});

export const updateProjetSchema = createProjetSchema.partial().extend({
  statut: z.enum(['non_valide', 'a_planifier', 'planifie', 'en_cours', 'termine']).optional(),
});

export const updateStatutSchema = z.object({
  statut: z.enum(['non_valide', 'a_planifier', 'planifie', 'en_cours', 'termine']),
});

export const updateGanttSchema = z.object({
  dateDebut: z.string().datetime().optional(),
  duree: z.number().int().positive().optional(),
});

export type CreateProjetInput = z.infer<typeof createProjetSchema>;
export type UpdateProjetInput = z.infer<typeof updateProjetSchema>;
