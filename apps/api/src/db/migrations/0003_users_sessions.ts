import type { Kysely } from 'kysely';

/**
 * Contas da oficina: usuários com e-mail e senha, sessões de login e o autor
 * de cada evento da OS. O e-mail é único no sistema inteiro (cada login entra
 * em exatamente uma oficina).
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('workshop_id', 'text', (c) => c.notNull().references('workshops.id'))
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('email', 'text', (c) => c.notNull().unique())
    .addColumn('password_hash', 'text', (c) => c.notNull())
    .addColumn('role', 'text', (c) => c.notNull())
    .addColumn('created_at', 'text', (c) => c.notNull())
    .addColumn('updated_at', 'text', (c) => c.notNull())
    .addColumn('disabled_at', 'text')
    .execute();
  await db.schema.createIndex('users_workshop_idx').on('users').column('workshop_id').execute();

  await db.schema
    .createTable('sessions')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('user_id', 'text', (c) => c.notNull().references('users.id'))
    .addColumn('token_hash', 'text', (c) => c.notNull().unique())
    .addColumn('created_at', 'text', (c) => c.notNull())
    .addColumn('expires_at', 'text', (c) => c.notNull())
    .addColumn('last_used_at', 'text')
    .execute();
  await db.schema.createIndex('sessions_user_idx').on('sessions').column('user_id').execute();

  await db.schema.alterTable('work_order_events').addColumn('actor_user_id', 'text').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('work_order_events').dropColumn('actor_user_id').execute();
  await db.schema.dropTable('sessions').ifExists().execute();
  await db.schema.dropTable('users').ifExists().execute();
}
