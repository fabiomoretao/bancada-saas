import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { createDb } from '../src/db/client';
import { migrateToLatest } from '../src/db/migrator';
import { seedDemo } from '../src/db/seed';

/** App completa com banco em memória: oficina demo + uma segunda oficina para testar isolamento. */
export async function setupTestApp() {
  const config = loadConfig();
  const db = createDb('sqlite::memory:');
  await migrateToLatest(db);

  const demo = await seedDemo(db, config.TOKEN_ENCRYPTION_KEY);
  const other = await seedDemo(db, config.TOKEN_ENCRYPTION_KEY, {
    workshop: { id: 'other-workshop', name: 'Outra Oficina' },
    firstOrderNumber: 900,
    orders: [
      {
        customer: { name: 'Cliente Sigiloso', phone: '(21) 90000-0000' },
        instrument: { type: 'Baixo', brand: 'MarcaSecreta' },
        problemReport: 'Não deve aparecer para a oficina demo.',
        status: 'received',
        receivedDaysAgo: 0,
        path: [],
      },
    ],
  });

  const app = createApp({ db, config });
  return { app, db, demo, other };
}
