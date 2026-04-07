import { z } from 'zod';

export const createActiviteSchema = z.object({
  description: z.string().min(1, 'Description requise'),
  date: z.string().datetime(),
  duree: z.number().positive().multipleOf(0.01),
  ressourceId: z.string().uuid('ID ressource invalide'),
  tacheId: z.string().uuid().optional(),
});

export const updateActiviteSchema = createActiviteSchema.partial();

export type CreateActiviteInput = z.infer<typeof createActiviteSchema>;
