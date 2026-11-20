import { sql, type Kysely } from 'kysely';

/**
 * Plano da oficina: Solo (1 acesso) ou Equipe (até 3), mensal ou anual.
 * Oficinas que já existiam ficam no Solo, exceto as que já têm mais de um
 * acesso ativo, que passam para o Equipe.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('workshops').addColumn('plan', 'text', (c) => c.notNull().defaultTo('solo')).execute();
  await db.schema.alterTable('workshops').addColumn('billing_cycle', 'text', (c) => c.notNull().defaultTo('monthly')).execute();
  await db.schema.alterTable('workshops').addColumn('plan_changed_at', 'text').execute();

  await sql`
    update workshops set plan = 'team'
    where (select count(*) from users u where u.workshop_id = workshops.id and u.disabled_at is null) > 1
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('workshops').dropColumn('plan_changed_at').execute();
  await db.schema.alterTable('workshops').dropColumn('billing_cycle').execute();
  await db.schema.alterTable('workshops').dropColumn('plan').execute();
}
