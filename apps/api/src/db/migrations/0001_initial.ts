import type { Kysely } from 'kysely';

/**
 * Esquema inicial. Usa apenas tipos portáveis (text, integer) para rodar igual
 * no SQLite e no PostgreSQL. Nomes de tabela/coluna em snake_case.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('workshops')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('next_order_number', 'integer', (c) => c.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (c) => c.notNull())
    .execute();

  await db.schema
    .createTable('customers')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('workshop_id', 'text', (c) => c.notNull().references('workshops.id'))
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('phone', 'text')
    .addColumn('email', 'text')
    .addColumn('created_at', 'text', (c) => c.notNull())
    .addColumn('updated_at', 'text', (c) => c.notNull())
    .execute();
  await db.schema.createIndex('customers_workshop_idx').on('customers').columns(['workshop_id', 'name']).execute();

  await db.schema
    .createTable('instruments')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('workshop_id', 'text', (c) => c.notNull().references('workshops.id'))
    .addColumn('customer_id', 'text', (c) => c.notNull().references('customers.id'))
    .addColumn('type', 'text', (c) => c.notNull())
    .addColumn('brand', 'text')
    .addColumn('model', 'text')
    .addColumn('serial_number', 'text')
    .addColumn('created_at', 'text', (c) => c.notNull())
    .execute();
  await db.schema.createIndex('instruments_workshop_idx').on('instruments').column('workshop_id').execute();
  await db.schema.createIndex('instruments_customer_idx').on('instruments').column('customer_id').execute();

  await db.schema
    .createTable('work_orders')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('workshop_id', 'text', (c) => c.notNull().references('workshops.id'))
    .addColumn('customer_id', 'text', (c) => c.notNull().references('customers.id'))
    .addColumn('instrument_id', 'text', (c) => c.notNull().references('instruments.id'))
    .addColumn('code', 'text', (c) => c.notNull())
    .addColumn('problem_report', 'text', (c) => c.notNull())
    .addColumn('intake_condition', 'text')
    .addColumn('accessories', 'text')
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('needs_parts', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('expected_ready_at', 'text')
    .addColumn('created_at', 'text', (c) => c.notNull())
    .addColumn('updated_at', 'text', (c) => c.notNull())
    .addColumn('closed_at', 'text')
    .addUniqueConstraint('work_orders_workshop_code_unique', ['workshop_id', 'code'])
    .execute();
  await db.schema.createIndex('work_orders_workshop_status_idx').on('work_orders').columns(['workshop_id', 'status']).execute();
  await db.schema.createIndex('work_orders_customer_idx').on('work_orders').column('customer_id').execute();
  await db.schema.createIndex('work_orders_instrument_idx').on('work_orders').column('instrument_id').execute();

  await db.schema
    .createTable('estimate_versions')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('work_order_id', 'text', (c) => c.notNull().references('work_orders.id'))
    .addColumn('version_number', 'integer', (c) => c.notNull())
    .addColumn('diagnosis', 'text', (c) => c.notNull())
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('currency', 'text', (c) => c.notNull().defaultTo('BRL'))
    .addColumn('needs_parts', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('estimated_business_days', 'integer')
    .addColumn('total_cents', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('created_at', 'text', (c) => c.notNull())
    .addColumn('published_at', 'text')
    .addColumn('decision_at', 'text')
    .addColumn('decision_message', 'text')
    .addUniqueConstraint('estimate_versions_order_version_unique', ['work_order_id', 'version_number'])
    .execute();

  await db.schema
    .createTable('estimate_items')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('estimate_version_id', 'text', (c) => c.notNull().references('estimate_versions.id').onDelete('cascade'))
    .addColumn('position', 'integer', (c) => c.notNull())
    .addColumn('type', 'text', (c) => c.notNull())
    .addColumn('description', 'text', (c) => c.notNull())
    .addColumn('quantity', 'integer', (c) => c.notNull())
    .addColumn('unit_price_cents', 'integer', (c) => c.notNull())
    .addColumn('line_total_cents', 'integer', (c) => c.notNull())
    .execute();
  await db.schema.createIndex('estimate_items_version_idx').on('estimate_items').column('estimate_version_id').execute();

  await db.schema
    .createTable('work_order_events')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('work_order_id', 'text', (c) => c.notNull().references('work_orders.id'))
    .addColumn('actor_type', 'text', (c) => c.notNull())
    .addColumn('event_type', 'text', (c) => c.notNull())
    .addColumn('from_status', 'text')
    .addColumn('to_status', 'text')
    .addColumn('message', 'text')
    .addColumn('visibility', 'text', (c) => c.notNull())
    .addColumn('idempotency_key', 'text')
    .addColumn('created_at', 'text', (c) => c.notNull())
    .execute();
  await db.schema.createIndex('work_order_events_order_idx').on('work_order_events').columns(['work_order_id', 'created_at']).execute();
  await db.schema
    .createIndex('work_order_events_idempotency_unique')
    .on('work_order_events')
    .columns(['work_order_id', 'idempotency_key'])
    .unique()
    .execute();

  await db.schema
    .createTable('public_access_tokens')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('work_order_id', 'text', (c) => c.notNull().references('work_orders.id'))
    .addColumn('token_hash', 'text', (c) => c.notNull().unique())
    .addColumn('token_encrypted', 'text', (c) => c.notNull())
    .addColumn('created_at', 'text', (c) => c.notNull())
    .addColumn('revoked_at', 'text')
    .addColumn('last_used_at', 'text')
    .execute();
  await db.schema.createIndex('public_access_tokens_order_idx').on('public_access_tokens').column('work_order_id').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of [
    'public_access_tokens',
    'work_order_events',
    'estimate_items',
    'estimate_versions',
    'work_orders',
    'instruments',
    'customers',
    'workshops',
  ]) {
    await db.schema.dropTable(table).ifExists().execute();
  }
}
