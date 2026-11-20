import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration';
import type { DB } from './client';
import * as m0001 from './migrations/0001_initial';
import * as m0002 from './migrations/0002_customer_contacts';
import * as m0003 from './migrations/0003_users_sessions';

/**
 * Migrações registradas em código (em ordem). Evita depender de leitura de
 * pasta, que se comporta diferente entre Windows e Linux.
 */
const migrations: Record<string, Migration> = {
  '0001_initial': m0001,
  '0002_customer_contacts': m0002,
  '0003_users_sessions': m0003,
};

const provider: MigrationProvider = {
  async getMigrations() {
    return migrations;
  },
};

export function createMigrator(db: DB): Migrator {
  return new Migrator({ db, provider });
}

export async function migrateToLatest(db: DB): Promise<void> {
  const { error, results } = await createMigrator(db).migrateToLatest();
  for (const result of results ?? []) {
    if (result.status === 'Error') console.error(`Falha na migração ${result.migrationName}`);
  }
  if (error) throw error;
}
