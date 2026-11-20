import type { RequestHandler, Response } from 'express';
import { AppError } from '../lib/errors';
import { readCookie, SESSION_COOKIE } from '../lib/cookies';
import { unauthenticated, type AuthContext, type AuthService } from '../modules/auth/auth.service';

/**
 * Exige sessão válida. Coloca em res.locals a oficina e o usuário: todas as
 * rotas da oficina filtram os dados por esse workshopId (isolamento do SaaS).
 */
export function requireAuth(service: AuthService): RequestHandler {
  return async (req, res, next) => {
    const ctx = await service.authenticate(readCookie(req.headers.cookie, SESSION_COOKIE));
    if (!ctx) return next(unauthenticated());
    res.locals.auth = ctx;
    res.locals.workshopId = ctx.workshopId;
    next();
  };
}

/** Só o responsável pela oficina (role "owner"). */
export const requireOwner: RequestHandler = (_req, res, next) => {
  if (getAuth(res).role !== 'owner') {
    return next(new AppError(403, 'forbidden', 'Só o responsável pela oficina pode fazer isso.'));
  }
  next();
};

export function getAuth(res: Response): AuthContext {
  const auth = res.locals.auth as AuthContext | undefined;
  if (!auth) throw new Error('requireAuth não foi aplicado a esta rota.');
  return auth;
}

export const getUserId = (res: Response) => getAuth(res).userId;
