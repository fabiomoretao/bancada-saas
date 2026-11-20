import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiErrorDTO } from '@bancada/shared';
import { AppError } from '../lib/errors';

export const notFoundHandler: RequestHandler = (_req, res) => {
  const body: ApiErrorDTO = { error: { code: 'route_not_found', message: 'Rota não encontrada.' } };
  res.status(404).json(body);
};

/**
 * Resposta de erro padronizada: { error: { code, message, fields? } }.
 * Erros inesperados são registrados sem a URL (que pode conter o token do
 * cliente) e sem o corpo da requisição.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    const body: ApiErrorDTO = { error: { code: err.code, message: err.message, fields: err.fields, duplicates: err.duplicates } };
    res.status(err.status).json(body);
    return;
  }

  if (isBodyParserError(err)) {
    const body: ApiErrorDTO = { error: { code: 'invalid_json', message: 'Corpo da requisição inválido.' } };
    res.status(400).json(body);
    return;
  }

  const route = req.baseUrl.startsWith('/api/public') ? '/api/public/…' : `${req.method} ${req.baseUrl}`;
  console.error(`[erro] ${route}:`, err instanceof Error ? err.message : err);
  const body: ApiErrorDTO = { error: { code: 'internal_error', message: 'Erro interno. Tente novamente.' } };
  res.status(500).json(body);
};

function isBodyParserError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'type' in err && (err as { type: unknown }).type === 'entity.parse.failed';
}
