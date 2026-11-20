import { createApp } from './app';
import { loadConfig } from './config';
import { createDb } from './db/client';
import { migrateToLatest } from './db/migrator';

const config = loadConfig();
const db = createDb(config.DATABASE_URL);
await migrateToLatest(db);

const app = createApp({ db, config });
const server = app.listen(config.PORT, () => {
  console.log(`API do Bancada em http://localhost:${config.PORT}`);
  console.log('Entre com a conta de demonstração (dono@bancada.demo / bancada123) ou crie uma conta nova.');
});

async function shutdown() {
  server.close();
  await db.destroy();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
