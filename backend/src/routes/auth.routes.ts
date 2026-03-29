import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js';
import { validate } from '../middleware/validate.middleware.js';
import { loginSchema, refreshSchema } from '../schemas/auth.schema.js';

const router = Router();

// POST /auth/login
router.post('/login', validate(loginSchema), async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  const ressource = await prisma.ressource.findUnique({ where: { email } });
  if (!ressource) {
    res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    return;
  }

  const valid = await bcrypt.compare(password, ressource.passwordHash);
  if (!valid) {
    res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    return;
  }

  const payload = { sub: ressource.id, email: ressource.email, role: ressource.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken({ sub: ressource.id });

  res.json({
    accessToken,
    refreshToken,
    user: { id: ressource.id, nom: ressource.nom, email: ressource.email, role: ressource.role },
  });
});

// POST /auth/refresh
router.post('/refresh', validate(refreshSchema), async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const ressource = await prisma.ressource.findUnique({ where: { id: decoded.sub } });
    if (!ressource) {
      res.status(401).json({ message: 'Utilisateur introuvable' });
      return;
    }

    const payload = { sub: ressource.id, email: ressource.email, role: ressource.role };
    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken({ sub: ressource.id });

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ message: 'Refresh token invalide ou expiré' });
  }
});

// POST /auth/logout
router.post('/logout', (_req: Request, res: Response): void => {
  // Stateless JWT — invalider côté client
  res.status(204).send();
});

export default router;
