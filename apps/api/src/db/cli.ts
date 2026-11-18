/**
 * Comandos de banco:
 *   tsx src/db/cli.ts migrate   aplica migrações pendentes
 *   tsx src/db/cli.ts rollback  desfaz a última migração
 *   tsx src/db/cli.ts seed      cria a oficina de demonstração (se ainda não existir)
 *   tsx src/db/cli.ts reset     apaga tudo, recria e popula a demonstração
 */
import { loadConfig } from '../config';
import { createDb } from './client';
import { createMigrator, migrateToLatest } from './migrator';
import { DEMO_WORKSHOP, seedDemo } from './seed';

const command = process.argv[2];
const config = loadConfig();
const db = createDb(config.DATABASE_URL);

async function seed() {
  const existing = await db.selectFrom('workshops').select('id').where('id', '=', DEMO_WORKSHOP.id).executeTakeFirst();
  if (existing) {
    console.log('A oficina de demonstração já existe. Use `npm run db:reset` para recriar do zero.');
    return;
  }
  const { links } = await seedDemo(db, config.TOKEN_ENCRYPTION_KEY);
  console.log(`Demonstração criada: ${Object.keys(links).length} ordens.`);
  for (const [code, path] of Object.entries(links)) console.log(`  ${code}  ${config.WEB_ORIGIN}${path}`);
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
