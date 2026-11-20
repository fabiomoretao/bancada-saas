import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors';

/**
 * Proteção contra CSRF: requisições que alteram dados só são aceitas sem
 * cabeçalho Origin (ferramentas, testes) ou vindas do próprio front.
 * Junto com o cookie SameSite=Lax, impede outro site de agir em nome do usuário.
 */
export function originCheck(allowedOrigin: string): RequestHandler {
  return (req, _res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    const origin = req.headers.origin;
    if (origin && origin !== allowedOrigin) {
      return next(new AppError(403, 'bad_origin', 'Requisição recusada: origem não autorizada.'));
    }
    next();
  };
}
