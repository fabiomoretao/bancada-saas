import type { InstrumentDetailDTO, InstrumentListDTO, WorkOrderStatus } from '@bancada/shared';
import { sql } from 'kysely';
import type { DB } from '../../db/client';
import { notFound } from '../../lib/errors';

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/** Consulta de instrumentos da oficina, com dono e histórico de ordens. */
export function createInstrumentsService({ db }: { db: DB }) {
  async function list(workshopId: string, query?: string): Promise<InstrumentListDTO> {
    let q = db
      .selectFrom('instruments as i')
      .innerJoin('customers as c', 'c.id', 'i.customerId')
      .where('i.workshopId', '=', workshopId)
      .select((eb) => [
        'i.id',
        'i.type',
        'i.brand',
        'i.model',
        'i.serialNumber',
        'c.id as customerId',
        'c.name as customerName',
        eb.selectFrom('workOrders as w').whereRef('w.instrumentId', '=', 'i.id').select((s) => s.fn.countAll<number>().as('n')).as('orderCount'),
        eb.selectFrom('workOrders as w').whereRef('w.instrumentId', '=', 'i.id').select((s) => s.fn.max('w.createdAt').as('m')).as('lastOrderAt'),
        eb
          .selectFrom('workOrders as w')
          .whereRef('w.instrumentId', '=', 'i.id')
          .select('w.status')
          .orderBy('w.createdAt', 'desc')
          .limit(1)
          .as('lastStatus'),
      ]);

    if (query) {
      const term = `%${escapeLike(query.toLowerCase())}%`;
      q = q.where((eb) =>
        eb.or(
          ['i.type', 'i.brand', 'i.model', 'i.serialNumber', 'c.name'].map((column) =>
            eb(sql`lower(${sql.ref(column)})`, 'like', sql`${term} escape '\\'`),
          ),
        ),
      );
    }

    const rows = await q.orderBy(sql`lower(${sql.ref('i.type')})`).orderBy('i.createdAt', 'desc').limit(200).execute();
    return {
      total: rows.length,
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        brand: r.brand,
        model: r.model,
        serialNumber: r.serialNumber,
        customer: { id: r.customerId, name: r.customerName },
        orderCount: Number(r.orderCount ?? 0),
        lastOrderAt: (r.lastOrderAt as string | null) ?? null,
        lastStatus: (r.lastStatus as WorkOrderStatus | null) ?? null,
      })),
    };
  }

  async function getDetail(workshopId: string, id: string): Promise<InstrumentDetailDTO> {
    const row = await db
      .selectFrom('instruments as i')
      .innerJoin('customers as c', 'c.id', 'i.customerId')
      .select(['i.id', 'i.type', 'i.brand', 'i.model', 'i.serialNumber', 'i.createdAt', 'c.id as customerId', 'c.name as customerName', 'c.phone', 'c.email'])
      .where('i.workshopId', '=', workshopId)
      .where('i.id', '=', id)
      .executeTakeFirst();
    if (!row) throw notFound('Instrumento não encontrado.');

    const orders = await db
      .selectFrom('workOrders')
      .select(['id', 'code', 'status', 'createdAt', 'expectedReadyAt'])
      .where('workshopId', '=', workshopId)
      .where('instrumentId', '=', id)
      .orderBy('createdAt', 'desc')
      .execute();

    const instrument = { type: row.type, brand: row.brand, model: row.model };
    return {
      id: row.id,
      ...instrument,
      serialNumber: row.serialNumber,
      createdAt: row.createdAt,
      customer: { id: row.customerId, name: row.customerName, phone: row.phone, email: row.email },
      orders: orders.map((o) => ({
        id: o.id,
        code: o.code,
        status: o.status,
        customerName: row.customerName,
        instrument,
        createdAt: o.createdAt,
        expectedReadyAt: o.expectedReadyAt,
        needsWorkshopAttention: o.status === 'revision_requested',
      })),
    };
  }

  return { list, getDetail };
}

export type InstrumentsService = ReturnType<typeof createInstrumentsService>;
