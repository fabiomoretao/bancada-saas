/** Erros de domínio com status HTTP e código estável para o front. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (message = 'Registro não encontrado.') => new AppError(404, 'not_found', message);

export const validationError = (fields: Record<string, string>, message = 'Confira os campos destacados.') =>
  new AppError(422, 'validation_error', message, fields);

export const conflict = (code: string, message: string) => new AppError(409, code, message);
