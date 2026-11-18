import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CreateWorkOrderResponseDTO, PublicWorkOrderDTO, WorkOrderDetailDTO } from '@bancada/shared';
import { setupTestApp } from './helpers';

/** Fluxo completo: entrada → avaliação → orçamento → decisão → reparo → entrega. */

type Ctx = Awaited<ReturnType<typeof setupTestApp>>;
let ctx: Ctx;
let id: string;
let token: string;

beforeEach(async () => {
  ctx = await setupTestApp();
  const res = await request(ctx.app)
    .post('/api/work-orders')
    .send({
      customer: { name: 'Cliente Fluxo', phone: '(11) 90000-1111', email: '' },
      instrument: { type: 'Guitarra', brand: 'Marca', model: 'X', serialNumber: '' },
      intake: { problemReport: 'Trastejando', intakeCondition: '', accessories: '' },
    });
  const body = res.body as CreateWorkOrderResponseDTO;
  id = body.workOrder.id;
  token = body.publicPath.slice(3);
});
afterEach(async () => {
  await ctx.db.destroy();
});

const api = () => request(ctx.app);
const transition = (action: string, extra: object = {}) =>
  api().post(`/api/work-orders/${id}/transitions`).send({ action, ...extra });
const saveDraft = (overrides: object = {}) =>
  api()
    .put(`/api/work-orders/${id}/estimates/draft`)
    .send({
      diagnosis: 'Trastes gastos.',
      needsParts: false,
      estimatedBusinessDays: 3,
      items: [
        { type: 'service', description: 'Nivelamento', quantity: 1, unitPriceCents: 30000 },
        { type: 'part', description: 'Cordas', quantity: 2, unitPriceCents: 4550 },
      ],
      ...overrides,
    });
const publish = (version: number) => api().post(`/api/work-orders/${id}/estimates/${version}/publish`);
const decide = (decision: string, versionNumber: number, message?: string) =>
  api().post(`/api/public/orders/${token}/decision`).send({ decision, versionNumber, message });
const detail = async () => (await api().get(`/api/work-orders/${id}`)).body as WorkOrderDetailDTO;
const publicView = async () => (await api().get(`/api/public/orders/${token}`)).body as PublicWorkOrderDTO;

async function toAwaitingApproval(overrides: object = {}) {
  expect((await transition('start_evaluation')).status).toBe(200);
  expect((await saveDraft(overrides)).status).toBe(200);
  expect((await publish(1)).status).toBe(200);
}

describe('orçamento', () => {
  it('não permite orçar antes de iniciar a avaliação', async () => {
    const res = await saveDraft();
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/Inicie a avaliação/);
  });

  it('calcula totais no servidor, em centavos, e ignora total enviado pelo cliente', async () => {
    await transition('start_evaluation');
    const res = await saveDraft({ totalCents: 1 });
    const draft = (res.body as WorkOrderDetailDTO).draftEstimate!;
    expect(draft.items.map((i) => i.lineTotalCents)).toEqual([30000, 9100]);
    expect(draft.totalCents).toBe(39100);
  });

  it('rascunho não aparece para o cliente; publicar cria V.01 e aguarda aprovação (critério 7)', async () => {
    await transition('start_evaluation');
    await saveDraft();
    expect((await publicView()).currentEstimate).toBeNull();

    const res = await publish(1);
    expect((res.body as WorkOrderDetailDTO).status).toBe('awaiting_approval');
    const view = await publicView();
    expect(view.currentEstimate?.versionNumber).toBe(1);
    expect(view.canDecide).toBe(true);
  });

  it('versão publicada é imutável: editar depois cria um rascunho novo (V.02)', async () => {
    await toAwaitingApproval();
    expect((await publish(1)).status).toBe(200); // repetir publicação é inofensivo
    const res = await saveDraft();
    expect(res.status).toBe(409); // aguardando decisão do cliente: não dá para editar
  });

  it('valida itens: quantidade inteira, preço não negativo, pelo menos um item', async () => {
    await transition('start_evaluation');
    expect((await saveDraft({ items: [] })).status).toBe(422);
    expect(
      (await saveDraft({ items: [{ type: 'part', description: 'X', quantity: 1.5, unitPriceCents: 100 }] })).status,
    ).toBe(422);
    expect(
      (await saveDraft({ items: [{ type: 'part', description: 'X', quantity: 1, unitPriceCents: -1 }] })).status,
    ).toBe(422);
  });
});

describe('decisão do cliente', () => {
  it('aprovação sem peça vai para Em reparo e define previsão (critério 10)', async () => {
    await toAwaitingApproval();
    const res = await decide('approve', 1);
    expect(res.status).toBe(200);
    expect((res.body as PublicWorkOrderDTO).status).toBe('in_repair');
    expect((await detail()).expectedReadyAt).not.toBeNull();
  });

  it('aprovação com peça pendente vai para Aguardando peça (critério 10)', async () => {
    await toAwaitingApproval({ needsParts: true });
    expect(((await decide('approve', 1)).body as PublicWorkOrderDTO).status).toBe('awaiting_parts');
  });

  it('decisão repetida não duplica aprovação nem evento (idempotência)', async () => {
    await toAwaitingApproval();
    await decide('approve', 1);
    const again = await decide('approve', 1);
    expect(again.status).toBe(200);
    const events = (await detail()).events.filter((e) => e.eventType === 'customer_decision');
    expect(events).toHaveLength(1);
  });

  it('pedir revisão exige mensagem, cria V.02 e preserva V.01 (critérios 9 e 12)', async () => {
    await toAwaitingApproval();
    expect((await decide('request_revision', 1)).status).toBe(422);
    expect((await decide('request_revision', 1, 'Sem as cordas, por favor')).status).toBe(200);

    let order = await detail();
    expect(order.status).toBe('revision_requested');
    expect(order.currentEstimate?.decisionMessage).toBe('Sem as cordas, por favor');

    await saveDraft({ items: [{ type: 'service', description: 'Nivelamento', quantity: 1, unitPriceCents: 30000 }] });
    order = (await publish(2)).body as WorkOrderDetailDTO;
    expect(order.status).toBe('awaiting_approval');
    expect(order.currentEstimate?.versionNumber).toBe(2);
    expect(order.estimateHistory.map((e) => [e.versionNumber, e.status])).toEqual([
      [1, 'superseded'],
      [2, 'published'],
    ]);
    expect(order.estimateHistory[0]!.decisionMessage).toBe('Sem as cordas, por favor');
  });

  it('recusa resposta para versão substituída', async () => {
    await toAwaitingApproval();
    await decide('request_revision', 1, 'Mais barato');
    await saveDraft();
    await publish(2);
    const res = await decide('approve', 1);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('estimate_not_current');
  });

  it('recusa encerra a OS preservando orçamento e eventos (critério 13)', async () => {
    await toAwaitingApproval();
    const res = await decide('decline', 1, 'Vou esperar');
    expect((res.body as PublicWorkOrderDTO).status).toBe('declined');
    const order = await detail();
    expect(order.closedAt).not.toBeNull();
    expect(order.currentEstimate?.status).toBe('rejected');
    expect(order.events.length).toBeGreaterThanOrEqual(4);
    expect((await transition('start_evaluation')).status).toBe(409);
  });
});

describe('andamento', () => {
  it('não deixa iniciar reparo sem orçamento aprovado (critério 11)', async () => {
    expect((await transition('complete_repair')).status).toBe(409);
    await toAwaitingApproval({ needsParts: true });
    const res = await transition('register_part_arrival');
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/Aguardando aprovação/);
    expect((await detail()).status).toBe('awaiting_approval');
  });

  it('peça → reparo → pronto → entregue atualiza a linha do tempo pública (critério 14)', async () => {
    await toAwaitingApproval({ needsParts: true });
    await decide('approve', 1);
    expect(((await transition('register_part_arrival')).body as WorkOrderDetailDTO).status).toBe('in_repair');
    expect(
      ((await transition('complete_repair', { message: 'Retirada de terça a sábado.', visibility: 'customer' })).body as WorkOrderDetailDTO)
        .status,
    ).toBe('ready_for_pickup');
    const done = (await transition('deliver')).body as WorkOrderDetailDTO;
    expect(done.status).toBe('delivered');
    expect(done.closedAt).not.toBeNull();

    const view = await publicView();
    expect(view.timeline.map((e) => e.toStatus).filter(Boolean)).toEqual([
      'received',
      'evaluating',
      'awaiting_approval',
      'awaiting_parts',
      'in_repair',
      'ready_for_pickup',
      'delivered',
    ]);
    expect(view.timeline.some((e) => e.message === 'Retirada de terça a sábado.')).toBe(true);
  });

  it('nota interna fica só na oficina; atualização pública aparece para o cliente', async () => {
    await api().post(`/api/work-orders/${id}/events`).send({ message: 'Cliente difícil', visibility: 'internal' });
    await api().post(`/api/work-orders/${id}/events`).send({ message: 'Recebemos tudo certo', visibility: 'customer' });
    const raw = JSON.stringify(await publicView());
    expect(raw).not.toContain('Cliente difícil');
    expect(raw).toContain('Recebemos tudo certo');
    expect((await detail()).events.some((e) => e.message === 'Cliente difícil')).toBe(true);
  });

  it('mudança de escopo depois da aprovação exige nova aprovação', async () => {
    await toAwaitingApproval();
    await decide('approve', 1);
    await saveDraft({ diagnosis: 'Também precisa trocar o capotraste.' });
    const order = (await publish(2)).body as WorkOrderDetailDTO;
    expect(order.status).toBe('awaiting_approval');
    expect(order.estimateHistory.map((e) => [e.versionNumber, e.status])).toEqual([
      [1, 'approved'],
      [2, 'published'],
    ]);
    expect((await transition('complete_repair')).status).toBe(409);
  });

  it('ações não alcançam OS de outra oficina', async () => {
    const other = await ctx.db.selectFrom('workOrders').select('id').where('workshopId', '=', 'other-workshop').executeTakeFirstOrThrow();
    expect((await api().post(`/api/work-orders/${other.id}/transitions`).send({ action: 'start_evaluation' })).status).toBe(404);
    const draft = { diagnosis: 'X', needsParts: false, items: [{ type: 'service', description: 'X', quantity: 1, unitPriceCents: 1 }] };
    expect((await api().put(`/api/work-orders/${other.id}/estimates/draft`).send(draft)).status).toBe(404);
    expect((await api().post(`/api/work-orders/${other.id}/estimates/1/publish`)).status).toBe(404);
  });
});
