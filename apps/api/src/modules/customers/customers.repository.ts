import { normalizeEmail, normalizePhone } from '@bancada/shared';
import { sql, type Transaction } from 'kysely';
import type { DB } from '../../db/client';
import type { Database } from '../../db/schema';

/**
 * Acesso ao banco para clientes. Toda consulta recebe e filtra por workshopId:
 * dados de clientes nunca saem da oficina dona do cadastro.
 */

type Executor = DB | Transaction<Database>;

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

export async function search(db: Executor, workshopId: string, query?: string) {
  let q = db
    .selectFrom('customers as c')
    .where('c.workshopId', '=', workshopId)
    .select((eb) => [
      'c.id',
      'c.name',
      'c.phone',
      'c.email',
      eb.selectFrom('instruments as i').whereRef('i.customerId', '=', 'c.id').select(eb.fn.countAll<number>().as('n')).as('instrumentCount'),
      eb.selectFrom('workOrders as w').whereRef('w.customerId', '=', 'c.id').select(eb.fn.countAll<number>().as('n')).as('orderCount'),
      eb.selectFrom('workOrders as w').whereRef('w.customerId', '=', 'c.id').select((sub) => sub.fn.max('w.createdAt').as('m')).as('lastOrderAt'),
    ]);

  if (query) {
    const text = `%${escapeLike(query.toLowerCase())}%`;
    const digits = query.replace(/\D/g, '');
    q = q.where((eb) => {
      const conditions = [
        eb(sql`lower(${sql.ref('c.name')})`, 'like', sql`${text} escape '\\'`),
        eb('c.emailNormalized', 'like', sql<string>`${text} escape '\\'`),
      ];
      // Busca por telefone só quando a pessoa digitou números suficientes.
      if (digits.length >= 3) conditions.push(eb('c.phoneDigits', 'like', `%${digits}%`));
      return eb.or(conditions);
    });
  }

  return q.orderBy(sql`lower(${sql.ref('c.name')})`).limit(100).execute();
}

export async function findById(db: Executor, workshopId: string, id: string) {
  return db.selectFrom('customers').selectAll().where('workshopId', '=', workshopId).where('id', '=', id).executeTakeFirst();
}

/** Cadastros da mesma oficina com o mesmo telefone ou e-mail (normalizados). */
export async function findContactMatches(
  db: Executor,
  workshopId: string,
  contact: { phone?: string | null; email?: string | null },
  excludeId?: string,
) {
  const phone = normalizePhone(contact.phone);
  const email = normalizeEmail(contact.email);
  if (!phone && !email) return [];

  let q = db
    .selectFrom('customers')
    .select(['id', 'name', 'phone', 'email', 'phoneDigits', 'emailNormalized'])
    .where('workshopId', '=', workshopId)
    .where((eb) => {
      const conditions = [];
      if (phone) conditions.push(eb('phoneDigits', '=', phone));
      if (email) conditions.push(eb('emailNormalized', '=', email));
      return eb.or(conditions);
    });
  if (excludeId) q = q.where('id', '!=', excludeId);

  const rows = await q.orderBy('name').limit(20).execute();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    matchedOn: [
      ...(phone && row.phoneDigits === phone ? (['phone'] as const) : []),
      ...(email && row.emailNormalized === email ? (['email'] as const) : []),
    ],
  }));
}

export async function listInstruments(db: Executor, workshopId: string, customerId: string) {
  return db
    .selectFrom('instruments as i')
    .where('i.workshopId', '=', workshopId)
    .where('i.customerId', '=', customerId)
    .select((eb) => [
      'i.id',
      'i.type',
      'i.brand',
      'i.model',
      'i.serialNumber',
      eb.selectFrom('workOrders as w').whereRef('w.instrumentId', '=', 'i.id').select(eb.fn.countAll<number>().as('n')).as('orderCount'),
      eb.selectFrom('workOrders as w').whereRef('w.instrumentId', '=', 'i.id').select((sub) => sub.fn.max('w.createdAt').as('m')).as('lastOrderAt'),
    ])
    .orderBy('i.createdAt', 'desc')
    .execute();
}

export async function listOrders(db: Executor, workshopId: string, customerId: string) {
  return db
    .selectFrom('workOrders as w')
    .innerJoin('instruments as i', 'i.id', 'w.instrumentId')
    .where('w.workshopId', '=', workshopId)
    .where('w.customerId', '=', customerId)
    .select([
      'w.id',
      'w.code',
      'w.status',
      'w.createdAt',
      'w.expectedReadyAt',
      'w.instrumentId',
      'i.type as instrumentType',
      'i.brand as instrumentBrand',
      'i.model as instrumentModel',
    ])
    .orderBy('w.createdAt', 'desc')
    .execute();
}

export async function insert(
  db: Executor,
  row: { id: string; workshopId: string; name: string; phone: string | null; email: string | null; now: string },
) {
  await db
    .insertInto('customers')
    .values({
      id: row.id,
      workshopId: row.workshopId,
      name: row.name,
      phone: row.phone,
      email: row.email,
      phoneDigits: normalizePhone(row.phone),
      emailNormalized: normalizeEmail(row.email),
      createdAt: row.now,
      updatedAt: row.now,
    })
    .execute();
}

export async function update(
  db: Executor,
  workshopId: string,
  id: string,
  data: { name: string; phone: string | null; email: string | null; now: string },
) {
  await db
    .updateTable('customers')
    .set({
      name: data.name,
      phone: data.phone,
      email: data.email,
      phoneDigits: normalizePhone(data.phone),
      emailNormalized: normalizeEmail(data.email),
      updatedAt: data.now,
    })
    .where('workshopId', '=', workshopId)
    .where('id', '=', id)
    .execute();
}
