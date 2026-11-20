import type { CustomerMatchDTO } from '@bancada/shared';

/** Erros de domínio com status HTTP e código estável para o front. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
    public readonly duplicates?: CustomerMatchDTO[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (message = 'Registro não encontrado.') => new AppError(404, 'not_found', message);

export const validationError = (fields: Record<string, string>, message = 'Confira os campos destacados.') =>
  new AppError(422, 'validation_error', message, fields);

export const conflict = (code: string, message: string) => new AppError(409, code, message);

export const possibleDuplicate = (duplicates: CustomerMatchDTO[]) =>
  new AppError(
    409,
    'possible_duplicate',
    duplicates.length === 1
      ? 'Já existe um cadastro com este telefone ou e-mail. Confira se é a mesma pessoa.'
      : `Já existem ${duplicates.length} cadastros com este telefone ou e-mail. Confira se é a mesma pessoa.`,
    undefined,
    duplicates,
  );

/** Violação de índice único (SQLite ou PostgreSQL), por exemplo dois cadastros simultâneos com o mesmo e-mail. */
export function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === 'SQLITE_CONSTRAINT_UNIQUE' || code === '23505';
}
