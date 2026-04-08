import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js';
import { authenticate, AuthRequest } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { loginSchema, refreshSchema } from '../schemas/auth.schema.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives de connexion, réessayez dans 15 minutes' },
});

async function buildPayload(ressource: { id: string; email: string; role: string }) {
  const responsablePoles = await prisma.responsablePole.findMany({
    where: { ressourceId: ressource.id },
    select: { poleId: true },
  });
  const responsablePoleIds = responsablePoles.map((rp) => rp.poleId);
  return {
    sub: ressource.id,
    email: ressource.email,
    role: ressource.role,
    responsablePoleIds: responsablePoleIds.length ? responsablePoleIds : undefined,
  };
}

// POST /auth/login
router.post('/login', loginLimiter, validate(loginSchema), async (req: Request, res: Response): Promise<void> => {
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

  // Réinitialise la session (invalide les tokens émis avant ce login)
  await prisma.ressource.update({
    where: { id: ressource.id },
    data: { loggedOutAt: null },
  });

  const payload = await buildPayload(ressource);
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

    const payload = await buildPayload(ressource);
    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken({ sub: ressource.id });

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ message: 'Refresh token invalide ou expiré' });
  }
});

// POST /auth/logout
router.post('/logout', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.ressource.update({
    where: { id: req.user!.sub },
    data: { loggedOutAt: new Date() },
  });
  res.status(204).send();
});

export default router;
