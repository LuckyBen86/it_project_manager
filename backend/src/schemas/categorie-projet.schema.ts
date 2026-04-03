import { z } from 'zod';

export const createCategorieSchema = z.object({
  nom:     z.string().min(1, 'Nom requis').max(100),
  poleIds: z.array(z.string().uuid()).optional(),
});

export const updateCategorieSchema = z.object({
  nom:     z.string().min(1).max(100).optional(),
  poleIds: z.array(z.string().uuid()).optional(),
});

export type CreateCategorieInput = z.infer<typeof createCategorieSchema>;
