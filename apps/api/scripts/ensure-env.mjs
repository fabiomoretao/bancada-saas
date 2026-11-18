// Cria apps/api/.env a partir do .env.example quando ele ainda não existe
// e preenche TOKEN_ENCRYPTION_KEY com uma chave aleatória.
// Funciona igual no Windows, macOS e Linux.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(apiDir, '.env');
const examplePath = join(apiDir, '.env.example');

if (existsSync(envPath)) {
  process.exit(0);
}

const key = randomBytes(32).toString('hex');
const content = readFileSync(examplePath, 'utf8').replace(/^TOKEN_ENCRYPTION_KEY=.*$/m, `TOKEN_ENCRYPTION_KEY=${key}`);
writeFileSync(envPath, content);
console.log('Arquivo apps/api/.env criado com uma chave nova.');
