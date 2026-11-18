import { sql, type Insertable, type Transaction } from 'kysely';
import type { WorkOrderStatus } from '@bancada/shared';
import type { DB } from '../../db/client';
import type {
  CustomerTable,
  Database,
  InstrumentTable,
  NewWorkOrderEvent,
  PublicAccessTokenTable,
  WorkOrderTable,
} from '../../db/schema';

/**
 * Único ponto de acesso ao banco para ordens de serviço.
 * Toda consulta da oficina recebe e filtra por workshopId.
 */

type Executor = DB | Transaction<Database>;

export interface ListFilters {
  query?: string;
  status?: WorkOrderStatus;
}

export async function listSummaries(db: Executor, workshopId: string, filters: ListFilters) {
  let q = db
    .selectFrom('workOrders as wo')
    .innerJoin('customers as c', 'c.id', 'wo.customerId')
    .innerJoin('instruments as i', 'i.id', 'wo.instrumentId')
    .where('wo.workshopId', '=', workshopId)
    .select([
      'wo.id',
      'wo.code',
      'wo.status',
      'wo.createdAt',
      'wo.expectedReadyAt',
      'c.name as customerName',
      'i.type as instrumentType',
      'i.brand as instrumentBrand',
      'i.model as instrumentModel',
    ]);

  if (filters.status) q = q.where('wo.status', '=', filters.status);

  if (filters.query) {
    const term = `%${escapeLike(filters.query.toLowerCase())}%`;
    q = q.where((eb) =>
      eb.or(
        ['wo.code', 'c.name', 'i.type', 'i.brand', 'i.model'].map((column) =>
          eb(sql`lower(${sql.ref(column)})`, 'like', sql`${term} escape '\\'`),
        ),
      ),
    );
  }

  return q.orderBy('wo.createdAt', 'desc').execute();
}

export async function findOrder(db: Executor, workshopId: string, id: string) {
  return db
    .selectFrom('workOrders')
    .selectAll()
    .where('workshopId', '=', workshopId)
    .where('id', '=', id)
    .executeTakeFirst();
}

export async function findCustomer(db: Executor, workshopId: string, id: string) {
  return db.selectFrom('customers').selectAll().where('workshopId', '=', workshopId).where('id', '=', id).executeTakeFirstOrThrow();
}

export async function findInstrument(db: Executor, workshopId: string, id: string) {
  return db.selectFrom('instruments').selectAll().where('workshopId', '=', workshopId).where('id', '=', id).executeTakeFirstOrThrow();
}

export async function listEstimates(db: Executor, workOrderId: string) {
  const versions = await db
    .selectFrom('estimateVersions')
    .selectAll()
    .where('workOrderId', '=', workOrderId)
    .orderBy('versionNumber', 'asc')
    .execute();
  if (versions.length === 0) return [];

  const items = await db
    .selectFrom('estimateItems')
    .selectAll()
    .where(
      'estimateVersionId',
      'in',
      versions.map((v) => v.id),
    )
    .orderBy('position', 'asc')
    .execute();

  return versions.map((version) => ({
    ...version,
    items: items.filter((item) => item.estimateVersionId === version.id),
  }));
}

export async function listEvents(db: Executor, workOrderId: string, onlyCustomerVisible = false) {
  let q = db.selectFrom('workOrderEvents').selectAll().where('workOrderId', '=', workOrderId);
  if (onlyCustomerVisible) q = q.where('visibility', '=', 'customer');
  return q.orderBy('createdAt', 'asc').orderBy('id', 'asc').execute();
}

export async function findActiveToken(db: Executor, workOrderId: string) {
  return db
    .selectFrom('publicAccessTokens')
    .selectAll()
    .where('workOrderId', '=', workOrderId)
    .where('revokedAt', 'is', null)
    .orderBy('createdAt', 'desc')
    .executeTakeFirst();
}

/** Reserva o próximo número de OS da oficina de forma atômica. */
export async function reserveOrderNumber(trx: Transaction<Database>, workshopId: string): Promise<number> {
  const row = await trx
    .updateTable('workshops')
    .set((eb) => ({ nextOrderNumber: eb('nextOrderNumber', '+', 1) }))
    .where('id', '=', workshopId)
    .returning('nextOrderNumber')
    .executeTakeFirst();
  if (!row) throw new Error(`Oficina ${workshopId} não encontrada.`);
  return row.nextOrderNumber - 1;
}

export const insertCustomer = (db: Executor, row: Insertable<CustomerTable>) =>
  db.insertInto('customers').values(row).execute();

export const insertInstrument = (db: Executor, row: Insertable<InstrumentTable>) =>
  db.insertInto('instruments').values(row).execute();

export const insertWorkOrder = (db: Executor, row: Insertable<WorkOrderTable>) =>
  db.insertInto('workOrders').values(row).execute();

export const insertEvent = (db: Executor, row: NewWorkOrderEvent) =>
  db.insertInto('workOrderEvents').values(row).execute();

export const insertToken = (db: Executor, row: Insertable<PublicAccessTokenTable>) =>
  db.insertInto('publicAccessTokens').values(row).execute();

export async function revokeTokens(db: Executor, workOrderId: string, at: string) {
  await db
    .updateTable('publicAccessTokens')
    .set({ revokedAt: at })
    .where('workOrderId', '=', workOrderId)
    .where('revokedAt', 'is', null)
    .execute();
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
