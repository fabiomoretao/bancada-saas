import { Router, type Request } from 'express';
import { changePasswordSchema, loginSchema, signupSchema } from '@bancada/shared';
import { clearedSessionCookie, sessionCookie } from '../../lib/cookies';
import { parseOrThrow } from '../../middleware/validate';
import { getAuth, requireAuth } from '../../middleware/auth';
import type { AuthService } from './auth.service';

const clientKey = (req: Request) => req.ip ?? 'unknown';

/** Criar conta, entrar, sair, sessão atual e troca de senha. */
export function authRouter(service: AuthService, { secureCookies }: { secureCookies: boolean }): Router {
  const router = Router();

  router.post('/signup', async (req, res) => {
    const data = parseOrThrow(signupSchema, req.body);
    const session = await service.signup(data);
    res.setHeader('Set-Cookie', sessionCookie(session.token, session.maxAgeSeconds, secureCookies));
    const ctx = await service.authenticate(session.token);
    res.status(201).json(await service.me(ctx!));
  });

  router.post('/login', async (req, res) => {
    const data = parseOrThrow(loginSchema, req.body);
    const session = await service.login(data, clientKey(req));
    res.setHeader('Set-Cookie', sessionCookie(session.token, session.maxAgeSeconds, secureCookies));
    const ctx = await service.authenticate(session.token);
    res.json(await service.me(ctx!));
  });

  router.post('/logout', requireAuth(service), async (_req, res) => {
    await service.logout(getAuth(res).sessionId);
    res.setHeader('Set-Cookie', clearedSessionCookie(secureCookies));
    res.status(204).end();
  });

  router.get('/me', requireAuth(service), async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await service.me(getAuth(res)));
  });

  router.post('/password', requireAuth(service), async (req, res) => {
    const data = parseOrThrow(changePasswordSchema, req.body);
    await service.changePassword(getAuth(res), data);
    res.status(204).end();
  });

  return router;
}
