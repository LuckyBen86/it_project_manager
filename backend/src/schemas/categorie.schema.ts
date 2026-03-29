import { z } from 'zod';

export const createCategorieSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(100),
  type: z.enum(['projet', 'tache']),
});

export const updateCategorieSchema = z.object({
  nom: z.string().min(1).max(100),
});

export type CreateCategorieInput = z.infer<typeof createCategorieSchema>;
