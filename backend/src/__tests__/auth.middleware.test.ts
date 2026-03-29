import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import * as jwtLib from '../lib/jwt.js';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  (res.status as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}

describe('authenticate middleware', () => {
  it('renvoie 401 si pas de header Authorization', () => {
    const req = { headers: {} } as AuthRequest;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('renvoie 401 si token invalide', () => {
    vi.spyOn(jwtLib, 'verifyAccessToken').mockImplementation(() => { throw new Error('invalid'); });
    const req = { headers: { authorization: 'Bearer bad_token' } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('appelle next() avec un token valide', () => {
    const payload = { sub: '1', email: 'a@b.com', role: 'responsable' };
    vi.spyOn(jwtLib, 'verifyAccessToken').mockReturnValue(payload);
    const req = { headers: { authorization: 'Bearer valid_token' } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(payload);
  });
});

describe('requireRole middleware', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renvoie 403 si rôle insuffisant', () => {
    const req = { user: { sub: '1', email: 'a@b.com', role: 'utilisateur' } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    requireRole('responsable')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('appelle next() si rôle suffisant', () => {
    const req = { user: { sub: '1', email: 'a@b.com', role: 'responsable' } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    requireRole('responsable')(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
