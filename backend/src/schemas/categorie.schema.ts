import { z } from 'zod';

export const createTagSchema = z.object({
  nom:     z.string().min(1, 'Nom requis').max(100),
  type:    z.enum(['projet', 'tache']),
  poleIds: z.array(z.string().uuid()).optional(),
});

export const updateTagSchema = z.object({
  nom:     z.string().min(1).max(100).optional(),
  poleIds: z.array(z.string().uuid()).optional(),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
