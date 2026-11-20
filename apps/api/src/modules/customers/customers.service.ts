import type {
  CustomerDetailDTO,
  CustomerDTO,
  CustomerListDTO,
  CustomerMatchDTO,
  customerSchema,
} from '@bancada/shared';
import type { z } from 'zod';
import type { DB } from '../../db/client';
import { notFound, possibleDuplicate } from '../../lib/errors';
import { newId, nowIso } from '../../lib/ids';
import * as repo from './customers.repository';

type CustomerData = z.output<typeof customerSchema>;

/**
 * Cadastro de clientes da oficina.
 * Telefone e e-mail não são únicos: um contato repetido gera um aviso de
 * possível duplicidade (409 com os cadastros parecidos), e a oficina decide
 * se usa o cadastro existente ou segue com `allowDuplicate`.
 */
export function createCustomersService({ db }: { db: DB }) {
  async function list(workshopId: string, query?: string): Promise<CustomerListDTO> {
    const rows = await repo.search(db, workshopId, query);
    return {
      total: rows.length,
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        instrumentCount: Number(row.instrumentCount ?? 0),
        orderCount: Number(row.orderCount ?? 0),
        lastOrderAt: (row.lastOrderAt as string | null) ?? null,
      })),
    };
  }

  async function getDetail(workshopId: string, id: string): Promise<CustomerDetailDTO> {
    const customer = await repo.findById(db, workshopId, id);
    if (!customer) throw notFound('Cliente não encontrado.');
    const [instruments, orders] = await Promise.all([
      repo.listInstruments(db, workshopId, id),
      repo.listOrders(db, workshopId, id),
    ]);
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      instruments: instruments.map((i) => ({
        id: i.id,
        type: i.type,
        brand: i.brand,
        model: i.model,
        serialNumber: i.serialNumber,
        orderCount: Number(i.orderCount ?? 0),
        lastOrderAt: (i.lastOrderAt as string | null) ?? null,
      })),
      orders: orders.map((o) => ({
        id: o.id,
        code: o.code,
        status: o.status,
        customerName: customer.name,
        instrumentId: o.instrumentId,
        instrument: { type: o.instrumentType, brand: o.instrumentBrand, model: o.instrumentModel },
        createdAt: o.createdAt,
        expectedReadyAt: o.expectedReadyAt,
        needsWorkshopAttention: o.status === 'revision_requested',
      })),
    };
  }

  async function findDuplicates(
    workshopId: string,
    contact: { phone?: string; email?: string },
    excludeId?: string,
  ): Promise<CustomerMatchDTO[]> {
    return repo.findContactMatches(db, workshopId, contact, excludeId);
  }

  /** Lança 409 `possible_duplicate` se o contato já existir e a oficina não confirmou. */
  async function assertNoUnconfirmedDuplicate(
    workshopId: string,
    data: { phone?: string; email?: string; allowDuplicate: boolean },
    excludeId?: string,
  ) {
    if (data.allowDuplicate) return;
    const matches = await findDuplicates(workshopId, data, excludeId);
    if (matches.length > 0) throw possibleDuplicate(matches);
  }

  async function create(workshopId: string, data: CustomerData): Promise<CustomerDTO> {
    await assertNoUnconfirmedDuplicate(workshopId, data);
    const id = newId();
    await repo.insert(db, {
      id,
      workshopId,
      name: data.name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      now: nowIso(),
    });
    return { id, name: data.name, phone: data.phone ?? null, email: data.email ?? null };
  }

  async function update(workshopId: string, id: string, data: CustomerData): Promise<CustomerDetailDTO> {
    const existing = await repo.findById(db, workshopId, id);
    if (!existing) throw notFound('Cliente não encontrado.');
    await assertNoUnconfirmedDuplicate(workshopId, data, id);
    await repo.update(db, workshopId, id, {
      name: data.name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      now: nowIso(),
    });
    return getDetail(workshopId, id);
  }

  return { list, getDetail, findDuplicates, assertNoUnconfirmedDuplicate, create, update };
}

export type CustomersService = ReturnType<typeof createCustomersService>;
