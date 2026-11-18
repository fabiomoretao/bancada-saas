import type { z } from 'zod';
import { validationError } from '../lib/errors';

/** Valida com Zod e converte os erros em { campo: mensagem } para o front. */
export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  throw validationError(fields);
}
