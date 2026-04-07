import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../lib/jwt.js';
import prisma from '../lib/prisma.js';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Token manquant' });
    return;
  }

  const token = authHeader.slice(7);
  let payload: JwtPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    res.status(401).json({ message: 'Token invalide ou expiré' });
    return;
  }

  const ressource = await prisma.ressource.findUnique({
    where: { id: payload.sub },
    select: { id: true, loggedOutAt: true },
  });
  if (!ressource) {
    res.status(401).json({ message: 'Utilisateur introuvable' });
    return;
  }

  if (ressource.loggedOutAt && payload.iat !== undefined && payload.iat < ressource.loggedOutAt.getTime() / 1000) {
    res.status(401).json({ message: 'Session expirée, veuillez vous reconnecter' });
    return;
  }

  req.user = payload;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: 'Accès refusé : droits insuffisants' });
      return;
    }
    next();
  };
}
