/**
 * Comandos de banco:
 *   tsx src/db/cli.ts migrate   aplica migrações pendentes
 *   tsx src/db/cli.ts rollback  desfaz a última migração
 *   tsx src/db/cli.ts seed      cria a oficina de demonstração (se ainda não existir)
 *   tsx src/db/cli.ts reset     apaga tudo, recria e popula a demonstração
 *
 * `seed` e `reset` gravam ACESSO-LOCAL.md na raiz do projeto com as contas e a
 * senha da demonstração. Esse arquivo fica só no computador (está no .gitignore).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLANS, ROLE_LABELS } from '@bancada/shared';
import { loadConfig } from '../config';
import { createDb } from './client';
import { createMigrator, migrateToLatest } from './migrator';
import { DEMO_USERS, DEMO_WORKSHOP, seedDemo } from './seed';

const ACCESS_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'ACESSO-LOCAL.md');

const command = process.argv[2];
const config = loadConfig();
const db = createDb(config.DATABASE_URL);

async function seed() {
  const password = config.DEMO_PASSWORD;
  if (!password) {
    throw new Error('DEMO_PASSWORD não está definida em apps/api/.env. Rode `npm run setup` para gerar uma.');
  }
  const existing = await db.selectFrom('workshops').select('id').where('id', '=', DEMO_WORKSHOP.id).executeTakeFirst();
  if (existing) {
    console.log('A oficina de demonstração já existe. Use `npm run db:reset` para recriar do zero.');
    return;
  }
  const { links } = await seedDemo(db, config.TOKEN_ENCRYPTION_KEY, password);
  writeAccessFile(password, links);
  console.log(`Demonstração criada: ${Object.keys(links).length} ordens.`);
  console.log('Contas e senha de acesso gravadas em ACESSO-LOCAL.md (na raiz do projeto, fora do Git).');
}

/** Arquivo local com os dados de acesso da demonstração. Nunca vai para o Git. */
function writeAccessFile(password: string, links: Record<string, string>) {
  const users = DEMO_USERS.map((u) => `| ${u.name} | \`${u.email}\` | ${ROLE_LABELS[u.role]} |`).join('\n');
  const orders = Object.entries(links)
    .map(([code, path]) => `| ${code} | ${config.WEB_ORIGIN}${path} |`)
    .join('\n');
  const plan = PLANS[DEMO_USERS.length > 1 ? 'team' : 'solo'];
  const content = `# Bancada — acesso local

> Arquivo gerado por \`npm run setup\` / \`npm run db:reset\` em ${new Date().toLocaleString('pt-BR')}.
> Fica só neste computador: está no \`.gitignore\` e não deve ser enviado ao GitHub nem colado em documentos.

**Endereço:** ${config.WEB_ORIGIN}

**Oficina de demonstração:** ${DEMO_WORKSHOP.name} (plano ${plan.name})

**Senha das contas:** \`${password}\`

| Pessoa | E-mail | Função |
|---|---|---|
${users}

A senha vem de \`DEMO_PASSWORD\` em \`apps/api/.env\`. Para trocar, edite esse valor e rode \`npm run db:reset\`.

## Links privados dos clientes

| OS | Link |
|---|---|
${orders}

Rodar \`npm run db:reset\` recria os dados e gera links novos (os antigos deixam de funcionar).
`;
  writeFileSync(ACCESS_FILE, content);
}

async function rollbackAll() {
  const migrator = createMigrator(db);
  for (;;) {
    const { error, results } = await migrator.migrateDown();
    if (error) throw error;
    if (!results || results.length === 0) break;
  }
}

try {
  switch (command) {
    case 'migrate':
      await migrateToLatest(db);
      console.log('Migrações aplicadas.');
      break;
    case 'rollback': {
      const { error } = await createMigrator(db).migrateDown();
      if (error) throw error;
      console.log('Última migração desfeita.');
      break;
    }
    case 'seed':
      await migrateToLatest(db);
      await seed();
      break;
    case 'reset':
      await rollbackAll();
      await migrateToLatest(db);
      await seed();
      break;
    default:
      console.error('Uso: tsx src/db/cli.ts <migrate|rollback|seed|reset>');
      process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
