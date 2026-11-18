import SQLite from 'better-sqlite3';
import { CamelCasePlugin, Kysely, PostgresDialect, SqliteDialect, type Dialect } from 'kysely';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import pg from 'pg';
import type { Database } from './schema';

export type DB = Kysely<Database>;

/**
 * Cria a conexão a partir de DATABASE_URL.
 *   sqlite:./data/bancada.db  → arquivo local (padrão do MVP)
 *   sqlite::memory:           → banco em memória (testes)
 *   postgres://…              → PostgreSQL (preparado; ainda não usado no MVP)
 */
export function createDb(databaseUrl: string): DB {
  return new Kysely<Database>({
    dialect: createDialect(databaseUrl),
    plugins: [new CamelCasePlugin()],
  });
}

function createDialect(databaseUrl: string): Dialect {
  if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
    return new PostgresDialect({ pool: new pg.Pool({ connectionString: databaseUrl, max: 10 }) });
  }

  const location = databaseUrl.replace(/^sqlite:/, '');
  const filename = location === ':memory:' ? ':memory:' : resolve(location);
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });

  const sqlite = new SQLite(filename);
  sqlite.pragma('foreign_keys = ON');
  if (filename !== ':memory:') sqlite.pragma('journal_mode = WAL');
  return new SqliteDialect({ database: sqlite });
}
