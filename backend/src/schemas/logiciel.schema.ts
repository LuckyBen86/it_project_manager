import { z } from 'zod';

export const createLogicielSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(100),
});

export const updateLogicielSchema = z.object({
  nom: z.string().min(1).max(100),
});

export type CreateLogicielInput = z.infer<typeof createLogicielSchema>;
