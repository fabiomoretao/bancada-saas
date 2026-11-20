import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  CreateWorkOrderResponseDTO,
  PublicWorkOrderDTO,
  WorkOrderDetailDTO,
  WorkOrderListDTO,
} from '@bancada/shared';
import { setupTestApp } from './helpers';

type Ctx = Awaited<ReturnType<typeof setupTestApp>>;
let ctx: Ctx;

beforeEach(async () => {
  ctx = await setupTestApp();
});
afterEach(async () => {
  await ctx.db.destroy();
});

const newOrder = (contact: { phone?: string; email?: string }, allowDuplicate = false) => ({
  customer: { mode: 'new', name: 'Teste da Silva', phone: contact.phone ?? '', email: contact.email ?? '', allowDuplicate },
  instrument: { mode: 'new', type: 'Guitarra', brand: 'Marca', model: 'Modelo', serialNumber: 'SERIE-123' },
  intake: { problemReport: 'Trastejando na 3ª casa', intakeCondition: '', accessories: 'Bag' },
});

describe('POST /api/work-orders', () => {
  it('cria OS só com telefone (critério 1) e inicia em Recebido (critério 5)', async () => {
    const res = await ctx.agent.post('/api/work-orders').send(newOrder({ phone: '(11) 91234-5678' }));
    expect(res.status).toBe(201);
    const body = res.body as CreateWorkOrderResponseDTO;
    expect(body.workOrder.status).toBe('received');
    expect(body.workOrder.code).toBe('OS-0249');
    expect(body.publicPath).toMatch(/^\/o\/[A-Za-z0-9_-]{43}$/);
    expect(body.workOrder.events.map((e) => e.eventType)).toEqual(['order_created']);
  });

  it('cria OS só com e-mail (critério 2)', async () => {
    const res = await ctx.agent.post('/api/work-orders').send(newOrder({ email: 'teste@example.com' }));
    expect(res.status).toBe(201);
  });

  it('bloqueia OS sem telefone e sem e-mail, apontando o grupo de contato (critério 3)', async () => {
    const res = await ctx.agent.post('/api/work-orders').send(newOrder({}));
    expect(res.status).toBe(422);
    expect(res.body.error.fields['customer.contact']).toMatch(/telefone ou e-mail/i);
  });

  it('bloqueia nome, tipo ou relato vazios (critério 4)', async () => {
    const base = newOrder({ phone: '11912345678' });
    const res = await ctx.agent
      .post('/api/work-orders')
      .send({ ...base, customer: { ...base.customer, name: '' }, intake: { problemReport: ' ' } });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(['customer.name', 'intake.problemReport']));
  });

  it('a OS criada persiste e aparece na fila (critério 5)', async () => {
    const created = await ctx.agent.post('/api/work-orders').send(newOrder({ phone: '11912345678' }));
    const list = await ctx.agent.get('/api/work-orders').query({ query: created.body.workOrder.code });
    expect((list.body as WorkOrderListDTO).items.map((i) => i.code)).toEqual([created.body.workOrder.code]);
  });

  it('gera códigos sequenciais por oficina', async () => {
    const a = await ctx.agent.post('/api/work-orders').send(newOrder({ phone: '11912345678' }));
    const b = await ctx.agent.post('/api/work-orders').send(newOrder({ phone: '11912345678' }, true));
    expect([a.body.workOrder.code, b.body.workOrder.code]).toEqual(['OS-0249', 'OS-0250']);
  });

  it('rejeita JSON malformado com erro claro', async () => {
    const res = await ctx.agent.post('/api/work-orders').set('Content-Type', 'application/json').send('{oops');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_json');
  });
});

describe('GET /api/work-orders', () => {
  const codes = (res: request.Response) => (res.body as WorkOrderListDTO).items.map((i) => i.code);

  it('busca por código, cliente e instrumento (critério 6)', async () => {
    expect(codes(await ctx.agent.get('/api/work-orders').query({ query: 'os-0243' }))).toEqual(['OS-0243']);
    expect(codes(await ctx.agent.get('/api/work-orders').query({ query: 'marina' }))).toEqual(['OS-0242']);
    expect(codes(await ctx.agent.get('/api/work-orders').query({ query: 'stingray' }))).toEqual(['OS-0245']);
  });

  it('filtra por status (critério 6)', async () => {
    const res = await ctx.agent.get('/api/work-orders').query({ status: 'in_repair' });
    expect(codes(res)).toEqual(['OS-0242']);
  });

  it('rejeita status desconhecido', async () => {
    const res = await ctx.agent.get('/api/work-orders').query({ status: 'qualquer' });
    expect(res.status).toBe(422);
  });

  it('trata % e _ na busca como texto, não como curinga', async () => {
    expect(codes(await ctx.agent.get('/api/work-orders').query({ query: '%' }))).toEqual([]);
  });

  it('nunca retorna ordens de outra oficina (critério 15)', async () => {
    const all = await ctx.agent.get('/api/work-orders');
    expect((all.body as WorkOrderListDTO).total).toBe(9);
    expect(codes(await ctx.agent.get('/api/work-orders').query({ query: 'MarcaSecreta' }))).toEqual([]);
  });
});

describe('GET /api/work-orders/:id', () => {
  it('retorna detalhe com orçamento vigente, histórico e link privado', async () => {
    const list = await ctx.agent.get('/api/work-orders').query({ query: 'OS-0243' });
    const id = (list.body as WorkOrderListDTO).items[0]!.id;
    const res = await ctx.agent.get(`/api/work-orders/${id}`);
    const detail = res.body as WorkOrderDetailDTO;
    expect(detail.status).toBe('awaiting_approval');
    expect(detail.currentEstimate?.versionNumber).toBe(1);
    expect(detail.currentEstimate?.totalCents).toBe(12700);
    expect(detail.publicPath).toBe(ctx.demo.links['OS-0243']);
  });

  it('não encontra OS de outra oficina pelo ID (critério 15)', async () => {
    const otherId = await ctx.db.selectFrom('workOrders').select('id').where('workshopId', '=', 'other-workshop').executeTakeFirstOrThrow();
    const res = await ctx.agent.get(`/api/work-orders/${otherId.id}`);
    expect(res.status).toBe(404);
  });
});

describe('link privado do cliente', () => {
  it('abre exatamente a OS do token (critério 7)', async () => {
    const res = await ctx.agent.get(`/api/public/orders/${ctx.demo.links['OS-0243']!.slice(3)}`);
    expect(res.status).toBe(200);
    const body = res.body as PublicWorkOrderDTO;
    expect(body.code).toBe('OS-0243');
    expect(body.canDecide).toBe(true);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('não revela contato, série, notas internas ou dados de outras OS (critério 8)', async () => {
    const created = await ctx.agent
      .post('/api/work-orders')
      .send(newOrder({ phone: '(11) 91234-5678', email: 'privado@example.com' }));
    const token = (created.body as CreateWorkOrderResponseDTO).publicPath.slice(3);
    const res = await ctx.agent.get(`/api/public/orders/${token}`);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('91234-5678');
    expect(raw).not.toContain('privado@example.com');
    expect(raw).not.toContain('SERIE-123');
    expect(raw).not.toContain('"id":"' + created.body.workOrder.id);

    // OS-0242 tem uma nota interna no seed
    const withNote = await ctx.agent.get(`/api/public/orders/${ctx.demo.links['OS-0242']!.slice(3)}`);
    expect(JSON.stringify(withNote.body)).not.toContain('sábado');
  });

  it('responde igual para token malformado e inexistente', async () => {
    const malformed = await ctx.agent.get('/api/public/orders/123');
    const missing = await ctx.agent.get(`/api/public/orders/${'A'.repeat(43)}`);
    expect(malformed.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(malformed.body).toEqual(missing.body);
  });

  it('regenerar o link revoga o anterior', async () => {
    const list = await ctx.agent.get('/api/work-orders').query({ query: 'OS-0243' });
    const id = (list.body as WorkOrderListDTO).items[0]!.id;
    const oldToken = ctx.demo.links['OS-0243']!.slice(3);

    const regenerated = await ctx.agent.post(`/api/work-orders/${id}/public-link`);
    expect(regenerated.status).toBe(201);
    const newToken = (regenerated.body.publicPath as string).slice(3);

    expect((await ctx.agent.get(`/api/public/orders/${oldToken}`)).status).toBe(404);
    expect((await ctx.agent.get(`/api/public/orders/${newToken}`)).status).toBe(200);
  });
});
