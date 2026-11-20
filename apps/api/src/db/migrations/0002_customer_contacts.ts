import { normalizeEmail, normalizePhone } from '@bancada/shared';
import type { Kysely } from 'kysely';

/**
 * Cadastro de clientes: colunas de contato normalizado para busca e aviso de
 * duplicidade. São índices comuns, NÃO únicos — telefone e e-mail podem ser
 * compartilhados (família, empresa) ou mudar com o tempo.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('customers').addColumn('phone_digits', 'text').execute();
  await db.schema.alterTable('customers').addColumn('email_normalized', 'text').execute();

  // Preenche os cadastros que já existiam.
  const rows = await db.selectFrom('customers').select(['id', 'phone', 'email']).execute();
  for (const row of rows) {
    await db
      .updateTable('customers')
      .set({ phone_digits: normalizePhone(row.phone), email_normalized: normalizeEmail(row.email) })
      .where('id', '=', row.id)
      .execute();
  }

  await db.schema.createIndex('customers_workshop_phone_idx').on('customers').columns(['workshop_id', 'phone_digits']).execute();
  await db.schema.createIndex('customers_workshop_email_idx').on('customers').columns(['workshop_id', 'email_normalized']).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('customers_workshop_email_idx').ifExists().execute();
  await db.schema.dropIndex('customers_workshop_phone_idx').ifExists().execute();
  await db.schema.alterTable('customers').dropColumn('email_normalized').execute();
  await db.schema.alterTable('customers').dropColumn('phone_digits').execute();
}
