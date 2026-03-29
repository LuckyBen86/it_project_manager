import { describe, it, expect, vi } from 'vitest';
import { validate } from '../middleware/validate.middleware.js';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  (res.status as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}

const schema = z.object({
  titre: z.string().min(1),
  duree: z.number().int().positive(),
});

describe('validate middleware', () => {
  it('passe si données valides', () => {
    const req = { body: { titre: 'Mon projet', duree: 5 } } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('renvoie 400 si données invalides', () => {
    const req = { body: { titre: '', duree: -1 } } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    validate(schema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('retourne les erreurs de champ', () => {
    const req = { body: {} } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    validate(schema)(req, res, next);

    const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(jsonCall.errors).toBeInstanceOf(Array);
    expect(jsonCall.errors.length).toBeGreaterThan(0);
  });
});
