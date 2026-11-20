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
  if (config.NODE_ENV !== 'production') {
    console.log('Contas da demonstração local: veja ACESSO-LOCAL.md na raiz do projeto (gerado por `npm run setup`).');
  }
});

async function shutdown() {
  server.close();
  await db.destroy();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
