import { z } from 'zod';

export const createTacheSchema = z.object({
  titre: z.string().min(1, 'Titre requis').max(255),
  description: z.string().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  dateDebut: z.string().datetime().optional(),
  dateButoire: z.string().datetime().optional(),
  duree: z.number().int().positive().optional(),
  ressourceIds: z.array(z.string().uuid()).optional(),
});

export const updateTacheSchema = createTacheSchema.partial().extend({
  statut: z.enum(['a_faire', 'en_cours', 'termine']).optional(),
});

export type CreateTacheInput = z.infer<typeof createTacheSchema>;
export type UpdateTacheInput = z.infer<typeof updateTacheSchema>;
