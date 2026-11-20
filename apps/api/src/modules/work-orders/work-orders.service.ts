import {
  isWorkOrderStatus,
  nextStatus,
  type CreateWorkOrderData,
  type EventVisibility,
  type WorkshopAction,
  type CreateWorkOrderResponseDTO,
  type WorkOrderDetailDTO,
  type WorkOrderListDTO,
} from '@bancada/shared';
import type { DB } from '../../db/client';
import { addBusinessDays } from '../../lib/business-days';
import { AppError, notFound, possibleDuplicate, validationError } from '../../lib/errors';
import * as customersRepo from '../customers/customers.repository';
import { formatOrderCode, newId, nowIso } from '../../lib/ids';
import { decryptToken, encryptToken, generateToken, hashToken, publicPathFor } from '../../lib/tokens';
import * as repo from './work-orders.repository';
import { pickCurrentEstimate, pickDraftEstimate, toEstimateDTO, toEventDTO } from './work-orders.mapper';
import { applyStatusChange } from './status-change';

/** Mensagem pública padrão de cada etapa (o cliente vê na linha do tempo). */
const DEFAULT_MESSAGES: Record<WorkshopAction, string> = {
  start_evaluation: 'A oficina iniciou a avaliação do instrumento.',
  register_part_arrival: 'A peça chegou. O reparo começou.',
  complete_repair: 'Reparo concluído. O instrumento está pronto para retirada.',
  deliver: 'Instrumento entregue. Obrigado!',
};

export interface WorkOrdersDeps {
  db: DB;
  tokenKey: string;
}

export function createWorkOrdersService({ db, tokenKey }: WorkOrdersDeps) {
  async function list(workshopId: string, filters: { query?: string; status?: string }): Promise<WorkOrderListDTO> {
    if (filters.status && !isWorkOrderStatus(filters.status)) {
      throw validationError({ status: 'Filtro de status desconhecido.' });
    }
    const rows = await repo.listSummaries(db, workshopId, {
      query: filters.query,
      status: filters.status && isWorkOrderStatus(filters.status) ? filters.status : undefined,
    });

    return {
      total: rows.length,
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        status: row.status,
        customerName: row.customerName,
        instrument: { type: row.instrumentType, brand: row.instrumentBrand, model: row.instrumentModel },
        createdAt: row.createdAt,
        expectedReadyAt: row.expectedReadyAt,
        needsWorkshopAttention: row.status === 'revision_requested',
      })),
    };
  }

  async function getDetail(workshopId: string, id: string): Promise<WorkOrderDetailDTO> {
    const order = await repo.findOrder(db, workshopId, id);
    if (!order) throw notFound('Ordem de serviço não encontrada.');

    const [customer, instrument, estimates, events, token] = await Promise.all([
      repo.findCustomer(db, workshopId, order.customerId),
      repo.findInstrument(db, workshopId, order.instrumentId),
      repo.listEstimates(db, order.id),
      repo.listEvents(db, order.id),
      repo.findActiveToken(db, order.id),
    ]);

    const current = pickCurrentEstimate(estimates);
    const draft = pickDraftEstimate(estimates);

    return {
      id: order.id,
      code: order.code,
      status: order.status,
      customer: { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email },
      instrument: {
        id: instrument.id,
        type: instrument.type,
        brand: instrument.brand,
        model: instrument.model,
        serialNumber: instrument.serialNumber,
      },
      problemReport: order.problemReport,
      intakeCondition: order.intakeCondition,
      accessories: order.accessories,
      needsParts: order.needsParts === 1,
      expectedReadyAt: order.expectedReadyAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      closedAt: order.closedAt,
      currentEstimate: current ? toEstimateDTO(current) : null,
      draftEstimate: draft ? toEstimateDTO(draft) : null,
      estimateHistory: estimates.filter((e) => e.status !== 'draft').map(toEstimateDTO),
      events: events.map(toEventDTO),
      publicPath: token ? publicPathFor(decryptToken(token.tokenEncrypted, tokenKey)) : null,
    };
  }

  /**
   * Abre a OS numa única transação: ou tudo é gravado, ou nada.
   * - Cliente: um cadastro existente da oficina ou um novo. Um novo cliente
   *   com telefone/e-mail já cadastrado gera aviso de duplicidade (409) até a
   *   oficina confirmar (`allowDuplicate`) ou escolher o cadastro existente.
   * - Instrumento: um já cadastrado para ESSE cliente, ou um novo.
   */
  async function create(workshopId: string, data: CreateWorkOrderData, userId?: string): Promise<CreateWorkOrderResponseDTO> {
    const now = nowIso();
    const ids = { order: newId() };
    const token = generateToken();

    await db.transaction().execute(async (trx) => {
      let customerId: string;
      if (data.customer.mode === 'existing') {
        const customer = await customersRepo.findById(trx, workshopId, data.customer.id);
        if (!customer) throw validationError({ 'customer.id': 'Cliente não encontrado. Busque e selecione de novo.' });
        customerId = customer.id;
      } else {
        if (!data.customer.allowDuplicate) {
          const matches = await customersRepo.findContactMatches(trx, workshopId, data.customer);
          if (matches.length > 0) throw possibleDuplicate(matches);
        }
        customerId = newId();
        await customersRepo.insert(trx, {
          id: customerId,
          workshopId,
          name: data.customer.name,
          phone: data.customer.phone ?? null,
          email: data.customer.email ?? null,
          now,
        });
      }

      let instrumentId: string;
      if (data.instrument.mode === 'existing') {
        const instrument = await trx
          .selectFrom('instruments')
          .select('id')
          .where('workshopId', '=', workshopId)
          .where('customerId', '=', customerId)
          .where('id', '=', data.instrument.id)
          .executeTakeFirst();
        if (!instrument) throw validationError({ 'instrument.id': 'Este instrumento não pertence ao cliente selecionado.' });
        instrumentId = instrument.id;
      } else {
        instrumentId = newId();
        await repo.insertInstrument(trx, {
          id: instrumentId,
          workshopId,
          customerId,
          type: data.instrument.type,
          brand: data.instrument.brand ?? null,
          model: data.instrument.model ?? null,
          serialNumber: data.instrument.serialNumber ?? null,
          createdAt: now,
        });
      }

      const orderNumber = await repo.reserveOrderNumber(trx, workshopId);

      await repo.insertWorkOrder(trx, {
        id: ids.order,
        workshopId,
        customerId,
        instrumentId,
        code: formatOrderCode(orderNumber),
        problemReport: data.intake.problemReport,
        intakeCondition: data.intake.intakeCondition ?? null,
        accessories: data.intake.accessories ?? null,
        status: 'received',
        needsParts: 0,
        expectedReadyAt: null,
        createdAt: now,
        updatedAt: now,
        closedAt: null,
      });

      await repo.insertToken(trx, {
        id: newId(),
        workOrderId: ids.order,
        tokenHash: hashToken(token),
        tokenEncrypted: encryptToken(token, tokenKey),
        createdAt: now,
        revokedAt: null,
        lastUsedAt: null,
      });

      await repo.insertEvent(trx, {
        id: newId(),
        workOrderId: ids.order,
        actorType: 'workshop',
        actorUserId: userId ?? null,
        eventType: 'order_created',
        fromStatus: null,
        toStatus: 'received',
        message: 'Instrumento recebido pela oficina.',
        visibility: 'customer',
        idempotencyKey: null,
        createdAt: now,
      });
    });

    return { workOrder: await getDetail(workshopId, ids.order), publicPath: publicPathFor(token) };
  }

  /** Revoga o link atual e gera outro. O link antigo deixa de funcionar. */
  async function regeneratePublicLink(workshopId: string, id: string, userId?: string): Promise<{ publicPath: string }> {
    const order = await repo.findOrder(db, workshopId, id);
    if (!order) throw notFound('Ordem de serviço não encontrada.');

    const now = nowIso();
    const token = generateToken();
    await db.transaction().execute(async (trx) => {
      await repo.revokeTokens(trx, order.id, now);
      await repo.insertToken(trx, {
        id: newId(),
        workOrderId: order.id,
        tokenHash: hashToken(token),
        tokenEncrypted: encryptToken(token, tokenKey),
        createdAt: now,
        revokedAt: null,
        lastUsedAt: null,
      });
      await repo.insertEvent(trx, {
        id: newId(),
        workOrderId: order.id,
        actorType: 'workshop',
        actorUserId: userId ?? null,
        eventType: 'public_link_regenerated',
        fromStatus: null,
        toStatus: null,
        message: 'Link privado regenerado; o anterior foi revogado.',
        visibility: 'internal',
        idempotencyKey: null,
        createdAt: now,
      });
    });
    return { publicPath: publicPathFor(token) };
  }

  /**
   * Ações da oficina que mudam o status. A máquina de estados decide se a
   * ação é permitida; se não for, nada muda e a resposta explica o motivo.
   */
  async function transition(
    workshopId: string,
    id: string,
    input: { action: WorkshopAction; message?: string; visibility: EventVisibility },
    userId?: string,
  ): Promise<WorkOrderDetailDTO> {
    const order = await repo.findOrder(db, workshopId, id);
    if (!order) throw notFound('Ordem de serviço não encontrada.');

    const result = nextStatus(order.status, input.action, { needsParts: order.needsParts === 1 });
    if (!result.ok) throw new AppError(409, 'invalid_transition', result.reason);

    const now = nowIso();
    await db.transaction().execute(async (trx) => {
      // Ao entrar em reparo, a previsão de pronto passa a contar a partir de agora.
      let expectedReadyAt: string | undefined;
      if (result.to === 'in_repair') {
        const approved = await trx
          .selectFrom('estimateVersions')
          .select('estimatedBusinessDays')
          .where('workOrderId', '=', order.id)
          .where('status', '=', 'approved')
          .orderBy('versionNumber', 'desc')
          .executeTakeFirst();
        if (approved?.estimatedBusinessDays) expectedReadyAt = addBusinessDays(new Date(now), approved.estimatedBusinessDays);
      }

      const publicMessage = input.visibility === 'customer' && input.message ? input.message : DEFAULT_MESSAGES[input.action];
      await applyStatusChange(trx, {
        order,
        to: result.to,
        actor: 'workshop',
        actorUserId: userId,
        eventType: 'status_changed',
        message: publicMessage,
        now,
        patch: expectedReadyAt ? { expectedReadyAt } : undefined,
      });

      if (input.message && input.visibility === 'internal') {
        await repo.insertEvent(trx, {
          id: newId(),
          workOrderId: order.id,
          actorType: 'workshop',
        actorUserId: userId ?? null,
          eventType: 'note',
          fromStatus: null,
          toStatus: null,
          message: input.message,
          visibility: 'internal',
          idempotencyKey: null,
          createdAt: now,
        });
      }
    });

    return getDetail(workshopId, id);
  }

  /** Nota interna ou atualização pública, sem mudar o status. */
  async function addNote(
    workshopId: string,
    id: string,
    input: { message: string; visibility: EventVisibility },
    userId?: string,
  ): Promise<WorkOrderDetailDTO> {
    const order = await repo.findOrder(db, workshopId, id);
    if (!order) throw notFound('Ordem de serviço não encontrada.');
    await repo.insertEvent(db, {
      id: newId(),
      workOrderId: order.id,
      actorType: 'workshop',
      actorUserId: userId ?? null,
      eventType: 'note',
      fromStatus: null,
      toStatus: null,
      message: input.message,
      visibility: input.visibility,
      idempotencyKey: null,
      createdAt: nowIso(),
    });
    return getDetail(workshopId, id);
  }

  return { list, getDetail, create, regeneratePublicLink, transition, addNote };
}

export type WorkOrdersService = ReturnType<typeof createWorkOrdersService>;
