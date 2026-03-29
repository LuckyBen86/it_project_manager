import { z } from 'zod';

export const createRessourceSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(255),
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum'),
  role: z.enum(['responsable', 'utilisateur']).default('utilisateur'),
});

export const updateRessourceSchema = z.object({
  nom: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['responsable', 'utilisateur']).optional(),
});

export type CreateRessourceInput = z.infer<typeof createRessourceSchema>;
export type UpdateRessourceInput = z.infer<typeof updateRessourceSchema>;
