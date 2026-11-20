// Prepara apps/api/.env (Windows, macOS e Linux):
// - cria o arquivo a partir do .env.example quando ele ainda não existe, com
//   uma TOKEN_ENCRYPTION_KEY aleatória;
// - garante uma DEMO_PASSWORD aleatória, usada só pelas contas da oficina de
//   demonstração local. Nenhuma senha fica no código ou no Git.
import { randomBytes, randomInt } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(apiDir, '.env');
const examplePath = join(apiDir, '.env.example');

/** Senha legível e aleatória, ex.: k7mq-x2vp-9ht4 (sem 0/o, 1/l/i). */
function randomPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const group = () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('');
  return `${group()}-${group()}-${group()}`;
}

if (!existsSync(envPath)) {
  const key = randomBytes(32).toString('hex');
  const content = readFileSync(examplePath, 'utf8')
    .replace(/^TOKEN_ENCRYPTION_KEY=.*$/m, `TOKEN_ENCRYPTION_KEY=${key}`)
    .replace(/^DEMO_PASSWORD=.*$/m, `DEMO_PASSWORD=${randomPassword()}`);
  writeFileSync(envPath, content);
  console.log('Arquivo apps/api/.env criado com uma chave e uma senha de demonstração novas.');
} else if (!/^DEMO_PASSWORD=\S{8,}/m.test(readFileSync(envPath, 'utf8'))) {
  // .env de uma versão anterior: acrescenta só a senha da demonstração.
  appendFileSync(
    envPath,
    `\n# Senha das contas da oficina de demonstração local (gerada automaticamente).\nDEMO_PASSWORD=${randomPassword()}\n`,
  );
  console.log('Senha de demonstração adicionada em apps/api/.env.');
}
