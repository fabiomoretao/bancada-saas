import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z
    .string()
    .default('sqlite:./data/bancada.db')
    .refine((v) => v.startsWith('sqlite:') || v.startsWith('postgres://') || v.startsWith('postgresql://'), {
      message: 'Use sqlite:<caminho> ou postgres://…',
    }),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'TOKEN_ENCRYPTION_KEY precisa ter 64 caracteres hexadecimais. Rode `npm run setup`.'),
  SESSION_DAYS: z.coerce.number().int().min(1).max(90).default(7),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuração inválida em apps/api/.env:\n${details}`);
  }
  return parsed.data;
}
