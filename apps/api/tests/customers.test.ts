import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  CreateWorkOrderResponseDTO,
  CustomerDetailDTO,
  CustomerDTO,
  CustomerListDTO,
  CustomerMatchDTO,
  PublicWorkOrderDTO,
} from '@bancada/shared';
import { setupTestApp } from './helpers';

/** Cadastro de clientes: busca, histórico, aviso de duplicidade e OS com cliente existente. */

type Ctx = Awaited<ReturnType<typeof setupTestApp>>;
let ctx: Ctx;

beforeEach(async () => {
  ctx = await setupTestApp();
});
afterEach(async () => {
  await ctx.db.destroy();
});

const api = () => ctx.agent;
const search = async (query: string) => ((await api().get('/api/customers').query({ query })).body as CustomerListDTO).items;
const findCustomer = async (name: string) => (await search(name))[0]!;

const intake = { problemReport: 'Revisão geral', intakeCondition: '', accessories: '' };

describe('busca e histórico', () => {
  it('encontra por nome, telefone (com ou sem máscara) e e-mail', async () => {
    expect((await search('alex')).map((c) => c.name)).toEqual(['Alex Ribeiro']);
    expect((await search('98888-1234')).map((c) => c.name)).toEqual(['Alex Ribeiro']);
    expect((await search('11988881234')).map((c) => c.name)).toEqual(['Alex Ribeiro']);
    expect((await search('JOANA.COSTA@')).map((c) => c.name)).toEqual(['Joana Costa']);
  });

  it('mostra instrumentos e ordens anteriores do cliente', async () => {
    const caio = await findCustomer('Caio');
    expect(caio.orderCount).toBe(2);
    expect(caio.instrumentCount).toBe(2);

    const detail = (await api().get(`/api/customers/${caio.id}`)).body as CustomerDetailDTO;
    expect(detail.instruments.map((i) => i.type).sort()).toEqual(['Cavaquinho', 'Violão']);
    expect(detail.orders.map((o) => o.code)).toEqual(['OS-0241', 'OS-0248']); // mais recente primeiro
  });

  it('não lista nem abre clientes de outra oficina', async () => {
    expect(await search('Sigiloso')).toEqual([]);
    const other = await ctx.db.selectFrom('customers').select('id').where('workshopId', '=', 'other-workshop').executeTakeFirstOrThrow();
    expect((await api().get(`/api/customers/${other.id}`)).status).toBe(404);
    expect((await api().put(`/api/customers/${other.id}`).send({ name: 'X', phone: '11900000000' })).status).toBe(404);
  });
});

describe('cadastro e duplicidade', () => {
  it('cadastra cliente novo com telefone ou e-mail', async () => {
    const res = await api().post('/api/customers').send({ name: 'Nova Pessoa', email: 'nova@example.com' });
    expect(res.status).toBe(201);
    expect((res.body as CustomerDTO).name).toBe('Nova Pessoa');
    expect((await api().post('/api/customers').send({ name: 'Sem Contato' })).body.error.fields.contact).toBeDefined();
  });

  it('avisa quando telefone ou e-mail já existe em outro cadastro', async () => {
    const res = await api().post('/api/customers').send({ name: 'Alexandre R.', phone: '+55 (11) 98888-1234' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('possible_duplicate');
    const [match] = res.body.error.duplicates as CustomerMatchDTO[];
    expect(match).toMatchObject({ name: 'Alex Ribeiro', matchedOn: ['phone'] });
  });

  it('permite seguir depois de conferir: telefone e e-mail não são únicos', async () => {
    const res = await api()
      .post('/api/customers')
      .send({ name: 'Irmão do Alex', phone: '(11) 98888-1234', allowDuplicate: true });
    expect(res.status).toBe(201);
    expect((await search('98888')).map((c) => c.name).sort()).toEqual(['Alex Ribeiro', 'Irmão do Alex']);
  });

  it('a checagem ao vivo não bloqueia e ignora o próprio cadastro na edição', async () => {
    const alex = await findCustomer('Alex');
    const live = await api().get('/api/customers/duplicates').query({ email: 'JOANA.costa@example.com' });
    expect((live.body.items as CustomerMatchDTO[]).map((m) => m.name)).toEqual(['Joana Costa']);

    const self = await api().get('/api/customers/duplicates').query({ phone: '11988881234', excludeId: alex.id });
    expect(self.body.items).toEqual([]);
  });

  it('edita o contato e avisa se o novo contato colide com outro cadastro', async () => {
    const alex = await findCustomer('Alex');
    const ok = await api().put(`/api/customers/${alex.id}`).send({ name: 'Alex Ribeiro', phone: '(11) 95555-0000' });
    expect((ok.body as CustomerDetailDTO).phone).toBe('(11) 95555-0000');

    const clash = await api().put(`/api/customers/${alex.id}`).send({ name: 'Alex Ribeiro', email: 'joana.costa@example.com' });
    expect(clash.status).toBe(409);
  });
});

describe('abertura da OS com cadastro', () => {
  it('OS aponta para o cliente selecionado e reaproveita um instrumento dele', async () => {
    const caio = await findCustomer('Caio');
    const detail = (await api().get(`/api/customers/${caio.id}`)).body as CustomerDetailDTO;
    const violao = detail.instruments.find((i) => i.type === 'Violão')!;

    const res = await api()
      .post('/api/work-orders')
      .send({ customer: { mode: 'existing', id: caio.id }, instrument: { mode: 'existing', id: violao.id }, intake });
    expect(res.status).toBe(201);
    const order = (res.body as CreateWorkOrderResponseDTO).workOrder;
    expect(order.customer.id).toBe(caio.id);
    expect(order.instrument.id).toBe(violao.id);

    const after = (await api().get(`/api/customers/${caio.id}`)).body as CustomerDetailDTO;
    expect(after.orders).toHaveLength(3);
    expect(after.instruments).toHaveLength(2);
  });

  it('cliente existente com instrumento novo cria o instrumento para ele', async () => {
    const caio = await findCustomer('Caio');
    const res = await api()
      .post('/api/work-orders')
      .send({ customer: { mode: 'existing', id: caio.id }, instrument: { mode: 'new', type: 'Ukulele' }, intake });
    expect(res.status).toBe(201);
    expect(((await api().get(`/api/customers/${caio.id}`)).body as CustomerDetailDTO).instruments).toHaveLength(3);
  });

  it('recusa instrumento de outro cliente', async () => {
    const caio = await findCustomer('Caio');
    const alex = (await api().get(`/api/customers/${(await findCustomer('Alex')).id}`)).body as CustomerDetailDTO;
    const res = await api()
      .post('/api/work-orders')
      .send({ customer: { mode: 'existing', id: caio.id }, instrument: { mode: 'existing', id: alex.instruments[0]!.id }, intake });
    expect(res.status).toBe(422);
    expect(res.body.error.fields['instrument.id']).toBeDefined();
  });

  it('recusa cliente de outra oficina', async () => {
    const other = await ctx.db.selectFrom('customers').select('id').where('workshopId', '=', 'other-workshop').executeTakeFirstOrThrow();
    const res = await api()
      .post('/api/work-orders')
      .send({ customer: { mode: 'existing', id: other.id }, instrument: { mode: 'new', type: 'Baixo' }, intake });
    expect(res.status).toBe(422);
    expect(res.body.error.fields['customer.id']).toBeDefined();
  });

  it('cliente novo com contato repetido gera aviso; nada é gravado até confirmar', async () => {
    const before = (await api().get('/api/work-orders')).body.total as number;
    const body = {
      customer: { mode: 'new', name: 'Alex R.', phone: '11 98888 1234', email: '' },
      instrument: { mode: 'new', type: 'Baixo' },
      intake,
    };
    const warned = await api().post('/api/work-orders').send(body);
    expect(warned.status).toBe(409);
    expect(warned.body.error.duplicates[0].name).toBe('Alex Ribeiro');
    expect((await api().get('/api/work-orders')).body.total).toBe(before);

    const confirmed = await api()
      .post('/api/work-orders')
      .send({ ...body, customer: { ...body.customer, allowDuplicate: true } });
    expect(confirmed.status).toBe(201);
  });

  it('dados do cadastro não aparecem no link do cliente', async () => {
    const caio = await findCustomer('Caio');
    const res = await api()
      .post('/api/work-orders')
      .send({ customer: { mode: 'existing', id: caio.id }, instrument: { mode: 'new', type: 'Ukulele' }, intake });
    const token = (res.body as CreateWorkOrderResponseDTO).publicPath.slice(3);
    const view = (await api().get(`/api/public/orders/${token}`)).body as PublicWorkOrderDTO;
    const raw = JSON.stringify(view);
    expect(raw).not.toContain('97777');
    expect(raw).not.toContain('Caio');
    expect(raw).not.toContain('Cavaquinho'); // outros instrumentos do cliente
  });
});
