import type { ApiErrorDTO } from '@bancada/shared';

/** Erro vindo da API, com mensagens por campo quando for validação. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Não foi possível falar com o servidor. Verifique se a API está rodando.');
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorDTO | null;
    throw new ApiError(
      response.status,
      body?.error.code ?? 'http_error',
      body?.error.message ?? `Erro ${response.status}.`,
      body?.error.fields,
    );
  }
  return (await response.json()) as T;
}

export const postJson = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
