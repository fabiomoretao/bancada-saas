import type { EstimateItemType, EstimateStatus, WorkOrderStatus } from '@bancada/shared';
import { lineTotalCents, totalCents } from '@bancada/shared';
import type { DB } from './client';
import { formatOrderCode, newId } from '../lib/ids';
import { encryptToken, generateToken, hashToken } from '../lib/tokens';

/**
 * Dados de demonstração: uma oficina fictícia com ordens em todos os estados.
 * As datas são relativas a "agora" para a fila sempre parecer atual.
 */

export const DEMO_WORKSHOP = { id: 'demo-workshop', name: 'Bancada do Centro' };

interface SeedEstimate {
  status: EstimateStatus;
  diagnosis: string;
  needsParts?: boolean;
  days?: number;
  items: Array<{ type: EstimateItemType; description: string; quantity?: number; unitPriceCents: number }>;
  decisionMessage?: string;
}

interface SeedOrder {
  customer: { name: string; phone?: string; email?: string };
  instrument: { type: string; brand?: string; model?: string; serialNumber?: string };
  problemReport: string;
  intakeCondition?: string;
  accessories?: string;
  status: WorkOrderStatus;
  /** Dias atrás em que o instrumento entrou. */
  receivedDaysAgo: number;
  /** Sequência de status percorrida, com mensagens públicas. */
  path: Array<{ to: WorkOrderStatus; actor?: 'workshop' | 'customer'; message: string; internal?: boolean }>;
  estimates?: SeedEstimate[];
}

const ORDERS: SeedOrder[] = [
  {
    customer: { name: 'Joana Costa', email: 'joana.costa@example.com' },
    instrument: { type: 'Guitarra', brand: 'Tagima', model: 'Semiacústica' },
    problemReport: 'Chiado ao girar o potenciômetro de tom e captador do braço falhando.',
    accessories: 'Bag',
    status: 'received',
    receivedDaysAgo: 3,
    path: [],
  },
  {
    customer: { name: 'Caio Martins', phone: '(11) 97777-2201' },
    instrument: { type: 'Violão', brand: 'Giannini', model: 'Aço' },
    problemReport: 'Cordas muito altas a partir da 7ª casa; difícil de tocar.',
    intakeCondition: 'Pequeno risco no tampo, próximo ao cavalete.',
    status: 'ready_for_pickup',
    receivedDaysAgo: 6,
    path: [
      { to: 'evaluating', message: 'Avaliação iniciada.' },
      { to: 'awaiting_approval', message: 'Orçamento publicado.' },
      { to: 'in_repair', actor: 'customer', message: 'Orçamento aprovado.' },
      { to: 'ready_for_pickup', message: 'Regulagem concluída. Pode retirar de terça a sábado, 10h–18h.' },
    ],
    estimates: [
      {
        status: 'approved',
        diagnosis: 'Ação alta por arqueamento do braço. Ajuste de tensor e rebaixo do rastilho resolvem.',
        days: 2,
        items: [
          { type: 'service', description: 'Regulagem completa', unitPriceCents: 18000 },
          { type: 'part', description: 'Jogo de cordas 0.011', unitPriceCents: 4500 },
        ],
      },
    ],
  },
  {
    customer: { name: 'Marina Lopes', phone: '(11) 96666-3302', email: 'marina@example.com' },
    instrument: { type: 'Guitarra', brand: 'Fender', model: 'Stratocaster', serialNumber: 'MX21004512' },
    problemReport: 'Trastes gastos nas primeiras casas; notas trastejando.',
    accessories: 'Case rígido, alavanca',
    status: 'in_repair',
    receivedDaysAgo: 4,
    path: [
      { to: 'evaluating', message: 'Avaliação iniciada.' },
      { to: 'awaiting_approval', message: 'Orçamento publicado.' },
      { to: 'in_repair', actor: 'customer', message: 'Orçamento aprovado.' },
      { to: 'in_repair', message: 'Cliente prefere retirar no sábado.', internal: true },
    ],
    estimates: [
      {
        status: 'approved',
        diagnosis: 'Desgaste nos trastes 1 a 5. Nivelamento e polimento recuperam sem troca.',
        days: 4,
        items: [{ type: 'service', description: 'Nivelamento e polimento de trastes', unitPriceCents: 35000 }],
      },
    ],
  },
  {
    customer: { name: 'Alex Ribeiro', phone: '(11) 98888-1234' },
    instrument: { type: 'Baixo', brand: 'Aurora', model: 'JB' },
    problemReport: 'O jack está com contato instável. O som falha quando o cabo se movimenta, e os controles fazem ruído.',
    status: 'awaiting_approval',
    receivedDaysAgo: 1,
    path: [
      { to: 'evaluating', message: 'Avaliação iniciada.' },
      { to: 'awaiting_approval', message: 'Orçamento publicado.' },
    ],
    estimates: [
      {
        status: 'published',
        diagnosis: 'Jack com contato instável; controles precisam de limpeza e ressolda.',
        needsParts: true,
        days: 2,
        items: [
          { type: 'part', description: 'Jack de saída blindado', unitPriceCents: 4200 },
          { type: 'service', description: 'Limpeza e ressolda', unitPriceCents: 8500 },
        ],
      },
    ],
  },
  {
    customer: { name: 'Renata Alves', email: 'renata.alves@example.com' },
    instrument: { type: 'Ukulele', brand: 'Kalani', model: 'Concert' },
    problemReport: 'Rachadura no tampo perto da boca.',
    status: 'revision_requested',
    receivedDaysAgo: 2,
    path: [
      { to: 'evaluating', message: 'Avaliação iniciada.' },
      { to: 'awaiting_approval', message: 'Orçamento publicado.' },
      { to: 'revision_requested', actor: 'customer', message: 'Dá para fazer só a colagem, sem o verniz?' },
    ],
    estimates: [
      {
        status: 'revision_requested',
        diagnosis: 'Rachadura de 6 cm no tampo. Colagem com tala interna e retoque de verniz.',
        days: 5,
        items: [
          { type: 'service', description: 'Colagem com tala interna', unitPriceCents: 16000 },
          { type: 'service', description: 'Retoque de verniz', unitPriceCents: 9000 },
        ],
        decisionMessage: 'Dá para fazer só a colagem, sem o verniz?',
      },
    ],
  },
  {
    customer: { name: 'Pedro Nunes', phone: '(11) 95555-4403' },
    instrument: { type: 'Baixo', brand: 'Music Man', model: 'StingRay' },
    problemReport: 'Tarraxa do Mi quebrada.',
    status: 'awaiting_parts',
    receivedDaysAgo: 5,
    path: [
      { to: 'evaluating', message: 'Avaliação iniciada.' },
      { to: 'awaiting_approval', message: 'Orçamento publicado.' },
      { to: 'awaiting_parts', actor: 'customer', message: 'Orçamento aprovado.' },
      { to: 'awaiting_parts', message: 'Peça encomendada. Avisaremos quando chegar.' },
    ],
    estimates: [
      {
        status: 'approved',
        diagnosis: 'Engrenagem da tarraxa do Mi quebrada. Troca da tarraxa.',
        needsParts: true,
        days: 1,
        items: [
          { type: 'part', description: 'Tarraxa para baixo', unitPriceCents: 9800 },
          { type: 'service', description: 'Instalação e regulagem', unitPriceCents: 6000 },
        ],
      },
    ],
  },
  {
    customer: { name: 'Luísa Prado', phone: '(11) 94444-5504' },
    instrument: { type: 'Violino', brand: 'Eagle', model: '4/4' },
    problemReport: 'Alma caiu depois de uma queda.',
    status: 'evaluating',
    receivedDaysAgo: 1,
    path: [{ to: 'evaluating', message: 'Avaliação iniciada.' }],
  },
  {
    customer: { name: 'Bruno Teixeira', email: 'bruno.t@example.com' },
    instrument: { type: 'Guitarra', brand: 'Gibson', model: 'Les Paul' },
    problemReport: 'Troca de captadores.',
    status: 'declined',
    receivedDaysAgo: 12,
    path: [
      { to: 'evaluating', message: 'Avaliação iniciada.' },
      { to: 'awaiting_approval', message: 'Orçamento publicado.' },
      { to: 'declined', actor: 'customer', message: 'Vou deixar para depois.' },
    ],
    estimates: [
      {
        status: 'rejected',
        diagnosis: 'Troca do par de captadores humbucker e blindagem da cavidade.',
        needsParts: true,
        days: 3,
        items: [
          { type: 'part', description: 'Par de captadores humbucker', unitPriceCents: 89000 },
          { type: 'service', description: 'Instalação e blindagem', unitPriceCents: 22000 },
        ],
        decisionMessage: 'Vou deixar para depois.',
      },
    ],
  },
  {
    customer: { name: 'Sofia Mendes', phone: '(11) 93333-6605' },
    instrument: { type: 'Cavaquinho', brand: 'Rozini' },
    problemReport: 'Troca de cordas e limpeza.',
    status: 'delivered',
    receivedDaysAgo: 15,
    path: [
      { to: 'evaluating', message: 'Avaliação iniciada.' },
      { to: 'awaiting_approval', message: 'Orçamento publicado.' },
      { to: 'in_repair', actor: 'customer', message: 'Orçamento aprovado.' },
      { to: 'ready_for_pickup', message: 'Pronto para retirada.' },
      { to: 'delivered', message: 'Instrumento entregue.' },
    ],
    estimates: [
      {
        status: 'approved',
        diagnosis: 'Cordas oxidadas. Troca e limpeza geral.',
        days: 1,
        items: [
          { type: 'part', description: 'Jogo de cordas', unitPriceCents: 3500 },
          { type: 'service', description: 'Limpeza e troca', unitPriceCents: 5000 },
        ],
      },
    ],
  },
];

export interface SeedOptions {
  workshop?: { id: string; name: string };
  /** Primeiro número de OS (a demonstração começa em OS-0240). */
  firstOrderNumber?: number;
  orders?: SeedOrder[];
}

export async function seedDemo(db: DB, tokenKey: string, options: SeedOptions = {}) {
  const workshop = options.workshop ?? DEMO_WORKSHOP;
  const orders = options.orders ?? ORDERS;
  const firstNumber = options.firstOrderNumber ?? 240;
  const now = Date.now();
  const at = (daysAgo: number, minutes = 0) => new Date(now - daysAgo * 86_400_000 + minutes * 60_000).toISOString();
  const links: Record<string, string> = {};

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('workshops')
      .values({ id: workshop.id, name: workshop.name, nextOrderNumber: firstNumber + orders.length, createdAt: at(30) })
      .execute();

    for (const [index, order] of orders.entries()) {
      const created = at(order.receivedDaysAgo);
      const code = formatOrderCode(firstNumber + index);
      const ids = { customer: newId(), instrument: newId(), order: newId() };

      await trx
        .insertInto('customers')
        .values({
          id: ids.customer,
          workshopId: workshop.id,
          name: order.customer.name,
          phone: order.customer.phone ?? null,
          email: order.customer.email ?? null,
          createdAt: created,
          updatedAt: created,
        })
        .execute();

      await trx
        .insertInto('instruments')
        .values({
          id: ids.instrument,
          workshopId: workshop.id,
          customerId: ids.customer,
          type: order.instrument.type,
          brand: order.instrument.brand ?? null,
          model: order.instrument.model ?? null,
          serialNumber: order.instrument.serialNumber ?? null,
          createdAt: created,
        })
        .execute();

      const approved = order.estimates?.find((e) => e.status === 'approved');
      const terminal = order.status === 'delivered' || order.status === 'declined';
      const lastStep = at(order.receivedDaysAgo, 60 * 2 * order.path.length);

      await trx
        .insertInto('workOrders')
        .values({
          id: ids.order,
          workshopId: workshop.id,
          customerId: ids.customer,
          instrumentId: ids.instrument,
          code,
          problemReport: order.problemReport,
          intakeCondition: order.intakeCondition ?? null,
          accessories: order.accessories ?? null,
          status: order.status,
          needsParts: approved?.needsParts ? 1 : 0,
          expectedReadyAt: approved?.days ? at(order.receivedDaysAgo - approved.days - 1) : null,
          createdAt: created,
          updatedAt: lastStep,
          closedAt: terminal ? lastStep : null,
        })
        .execute();

      // Eventos: criação + cada passo do caminho, espaçados de 2 em 2 horas.
      const events = [
        { to: 'received' as WorkOrderStatus, from: null as WorkOrderStatus | null, actor: 'workshop' as 'workshop' | 'customer', message: 'Instrumento recebido pela oficina.', internal: false, type: 'order_created' },
      ];
      let previous: WorkOrderStatus = 'received';
      for (const step of order.path) {
        const isNote = step.to === previous;
        events.push({
          to: step.to,
          from: isNote ? null : previous,
          actor: step.actor ?? 'workshop',
          message: step.message,
          internal: step.internal ?? false,
          type: isNote ? 'note' : step.to === 'awaiting_approval' ? 'estimate_published' : 'status_changed',
        });
        previous = step.to;
      }
      for (const [i, event] of events.entries()) {
        await trx
          .insertInto('workOrderEvents')
          .values({
            id: newId(),
            workOrderId: ids.order,
            actorType: event.actor,
            eventType: event.type,
            fromStatus: event.from,
            toStatus: event.type === 'note' ? null : event.to,
            message: event.message,
            visibility: event.internal ? 'internal' : 'customer',
            idempotencyKey: null,
            createdAt: at(order.receivedDaysAgo, 120 * i),
          })
          .execute();
      }

      for (const [v, estimate] of (order.estimates ?? []).entries()) {
        const estimateId = newId();
        const items = estimate.items.map((item, position) => ({
          id: newId(),
          estimateVersionId: estimateId,
          position,
          type: item.type,
          description: item.description,
          quantity: item.quantity ?? 1,
          unitPriceCents: item.unitPriceCents,
          lineTotalCents: lineTotalCents({ quantity: item.quantity ?? 1, unitPriceCents: item.unitPriceCents }),
        }));
        const decided = ['approved', 'revision_requested', 'rejected'].includes(estimate.status);
        await trx
          .insertInto('estimateVersions')
          .values({
            id: estimateId,
            workOrderId: ids.order,
            versionNumber: v + 1,
            diagnosis: estimate.diagnosis,
            status: estimate.status,
            currency: 'BRL',
            needsParts: estimate.needsParts ? 1 : 0,
            estimatedBusinessDays: estimate.days ?? null,
            totalCents: totalCents(items),
            createdAt: at(order.receivedDaysAgo, 200),
            publishedAt: estimate.status === 'draft' ? null : at(order.receivedDaysAgo, 240),
            decisionAt: decided ? at(order.receivedDaysAgo, 360) : null,
            decisionMessage: estimate.decisionMessage ?? null,
          })
          .execute();
        await trx.insertInto('estimateItems').values(items).execute();
      }

      const token = generateToken();
      await trx
        .insertInto('publicAccessTokens')
        .values({
          id: newId(),
          workOrderId: ids.order,
          tokenHash: hashToken(token),
          tokenEncrypted: encryptToken(token, tokenKey),
          createdAt: created,
          revokedAt: null,
          lastUsedAt: null,
        })
        .execute();
      links[code] = `/o/${token}`;
    }
  });

  return { workshopId: workshop.id, links };
}
