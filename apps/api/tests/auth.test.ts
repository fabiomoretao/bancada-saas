import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  InstrumentDetailDTO,
  InstrumentListDTO,
  SessionDTO,
  TeamMemberDTO,
  WorkOrderDetailDTO,
  WorkOrderListDTO,
} from '@bancada/shared';
import { setupTestApp, TEST_PASSWORD } from './helpers';

/** Contas, sessões, equipe e instrumentos. */

type Ctx = Awaited<ReturnType<typeof setupTestApp>>;
let ctx: Ctx;

beforeEach(async () => {
  ctx = await setupTestApp();
});
afterEach(async () => {
  await ctx.db.destroy();
});

const anon = () => request(ctx.app);

describe('acesso à área da oficina', () => {
  it('sem login, as rotas da oficina respondem 401', async () => {
    for (const path of ['/api/work-orders', '/api/customers', '/api/instruments', '/api/team', '/api/auth/me']) {
      const res = await anon().get(path);
      expect(res.status, path).toBe(401);
      expect(res.body.error.code).toBe('unauthenticated');
    }
  });

  it('o link público continua funcionando sem conta', async () => {
    const token = ctx.demo.links['OS-0243']!.slice(3);
    expect((await anon().get(`/api/public/orders/${token}`)).status).toBe(200);
  });

  it('login usa cookie httpOnly e SameSite; /me mostra usuário e oficina', async () => {
    const res = await anon().post('/api/auth/login').send({ email: 'DONO@bancada.demo', password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/bancada_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect((res.body as SessionDTO).workshop.name).toBe('Bancada do Centro');

    const me = (await ctx.agent.get('/api/auth/me')).body as SessionDTO;
    expect(me.user).toMatchObject({ email: 'dono@bancada.demo', role: 'owner' });
  });

  it('senha errada e e-mail inexistente recebem a mesma resposta', async () => {
    const wrong = await anon().post('/api/auth/login').send({ email: 'dono@bancada.demo', password: 'errada123' });
    const missing = await anon().post('/api/auth/login').send({ email: 'ninguem@x.com', password: 'errada123' });
    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.body).toEqual(missing.body);
  });

  it('bloqueia depois de muitas tentativas', async () => {
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (await anon().post('/api/auth/login').send({ email: 'dono@bancada.demo', password: `x${i}xxxxxxx` })).status;
    }
    expect(last).toBe(429);
  });

  it('sair invalida a sessão', async () => {
    expect((await ctx.agent.post('/api/auth/logout')).status).toBe(204);
    expect((await ctx.agent.get('/api/work-orders')).status).toBe(401);
  });

  it('recusa alteração vinda de outro site (CSRF)', async () => {
    const res = await ctx.agent.post('/api/customers').set('Origin', 'https://site-malicioso.example').send({ name: 'X', phone: '11999999999' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('bad_origin');
  });
});

describe('criar conta (nova oficina)', () => {
  const signup = { workshopName: 'Luthieria Nova', name: 'Bia Souza', email: 'bia@nova.test', password: 'senha-forte-1' };

  it('cria a oficina e o responsável, e a nova oficina começa vazia', async () => {
    const agent = request.agent(ctx.app);
    const res = await agent.post('/api/auth/signup').send(signup);
    expect(res.status).toBe(201);
    expect((res.body as SessionDTO).user.role).toBe('owner');

    expect(((await agent.get('/api/work-orders')).body as WorkOrderListDTO).total).toBe(0);
    expect(((await agent.get('/api/customers')).body).total).toBe(0);
  });

  it('a primeira OS da oficina nova é OS-0001', async () => {
    const agent = request.agent(ctx.app);
    await agent.post('/api/auth/signup').send(signup);
    const res = await agent.post('/api/work-orders').send({
      customer: { mode: 'new', name: 'Cliente', phone: '11911112222' },
      instrument: { mode: 'new', type: 'Baixo' },
      intake: { problemReport: 'Revisão' },
    });
    expect(res.body.workOrder.code).toBe('OS-0001');
  });

  it('não deixa usar e-mail já cadastrado', async () => {
    const res = await anon().post('/api/auth/signup').send({ ...signup, email: 'dono@bancada.demo' });
    expect(res.status).toBe(409);
  });

  it('exige senha com 8 caracteres ou mais', async () => {
    const res = await anon().post('/api/auth/signup').send({ ...signup, password: '1234567' });
    expect(res.status).toBe(422);
    expect(res.body.error.fields.password).toBeDefined();
  });

  it('uma oficina nunca vê dados de outra, nem por ID', async () => {
    const other = await ctx.loginAs('outro@oficina.test');
    const demoOrder = ((await ctx.agent.get('/api/work-orders')).body as WorkOrderListDTO).items[0]!;
    expect((await other.get(`/api/work-orders/${demoOrder.id}`)).status).toBe(404);
    expect(((await other.get('/api/work-orders')).body as WorkOrderListDTO).total).toBe(1);
  });
});

describe('equipe', () => {
  const newStaff = { name: 'Lia Costa', email: 'lia@bancada.demo', password: 'senha-da-lia', role: 'staff' };

  it('responsável cadastra funcionário, que consegue entrar', async () => {
    const res = await ctx.agent.post('/api/team').send(newStaff);
    expect(res.status).toBe(201);
    const lia = await ctx.loginAs('lia@bancada.demo', 'senha-da-lia');
    expect(((await lia.get('/api/auth/me')).body as SessionDTO).user.role).toBe('staff');
    const team = (await ctx.agent.get('/api/team')).body.items as TeamMemberDTO[];
    expect(team.map((m) => m.email)).toContain('lia@bancada.demo');
  });

  it('técnico vê a equipe mas não cadastra nem altera', async () => {
    const teo = await ctx.loginAs('tecnico@bancada.demo');
    expect((await teo.get('/api/team')).status).toBe(200);
    expect((await teo.post('/api/team').send(newStaff)).status).toBe(403);
  });

  it('desativar encerra a sessão e bloqueia o login', async () => {
    const teo = await ctx.loginAs('tecnico@bancada.demo');
    const team = (await ctx.agent.get('/api/team')).body.items as TeamMemberDTO[];
    const teoId = team.find((m) => m.email === 'tecnico@bancada.demo')!.id;

    expect((await ctx.agent.patch(`/api/team/${teoId}`).send({ active: false })).body.active).toBe(false);
    expect((await teo.get('/api/work-orders')).status).toBe(401);
    expect((await anon().post('/api/auth/login').send({ email: 'tecnico@bancada.demo', password: TEST_PASSWORD })).status).toBe(403);
  });

  it('não deixa desativar a si mesmo nem ficar sem responsável', async () => {
    const team = (await ctx.agent.get('/api/team')).body.items as TeamMemberDTO[];
    const me = team.find((m) => m.email === 'dono@bancada.demo')!;
    expect((await ctx.agent.patch(`/api/team/${me.id}`).send({ active: false })).status).toBe(409);
    expect((await ctx.agent.patch(`/api/team/${me.id}`).send({ role: 'staff' })).status).toBe(409);
  });

  it('não altera usuário de outra oficina', async () => {
    const other = await ctx.loginAs('outro@oficina.test');
    const otherId = ((await other.get('/api/team')).body.items as TeamMemberDTO[])[0]!.id;
    expect((await ctx.agent.patch(`/api/team/${otherId}`).send({ active: false })).status).toBe(404);
  });

  it('trocar a senha exige a atual e passa a valer no login', async () => {
    expect((await ctx.agent.post('/api/auth/password').send({ currentPassword: 'errada', newPassword: 'nova-senha-123' })).status).toBe(422);
    expect((await ctx.agent.post('/api/auth/password').send({ currentPassword: TEST_PASSWORD, newPassword: 'nova-senha-123' })).status).toBe(204);
    expect((await anon().post('/api/auth/login').send({ email: 'dono@bancada.demo', password: TEST_PASSWORD })).status).toBe(401);
    expect((await anon().post('/api/auth/login').send({ email: 'dono@bancada.demo', password: 'nova-senha-123' })).status).toBe(200);
  });

  it('o histórico da OS mostra quem fez cada ação', async () => {
    const teo = await ctx.loginAs('tecnico@bancada.demo');
    const order = ((await teo.get('/api/work-orders').query({ query: 'OS-0240' })).body as WorkOrderListDTO).items[0]!;
    const detail = (await teo.post(`/api/work-orders/${order.id}/transitions`).send({ action: 'start_evaluation' })).body as WorkOrderDetailDTO;
    expect(detail.events.at(-1)?.actorName).toBe('Téo Martins');

    const token = ctx.demo.links['OS-0240']!.slice(3);
    expect(JSON.stringify((await anon().get(`/api/public/orders/${token}`)).body)).not.toContain('Téo');
  });
});

describe('instrumentos', () => {
  it('busca por tipo, marca, modelo, série e dono', async () => {
    const find = async (query: string) => ((await ctx.agent.get('/api/instruments').query({ query })).body as InstrumentListDTO).items;
    expect((await find('stratocaster')).map((i) => i.customer.name)).toEqual(['Marina Lopes']);
    expect((await find('MX2100')).map((i) => i.model)).toEqual(['Stratocaster']);
    expect((await find('caio')).map((i) => i.type).sort()).toEqual(['Cavaquinho', 'Violão']);
  });

  it('detalhe traz o dono e o histórico de ordens', async () => {
    const [strat] = ((await ctx.agent.get('/api/instruments').query({ query: 'stratocaster' })).body as InstrumentListDTO).items;
    const detail = (await ctx.agent.get(`/api/instruments/${strat!.id}`)).body as InstrumentDetailDTO;
    expect(detail.customer.name).toBe('Marina Lopes');
    expect(detail.orders.map((o) => o.code)).toEqual(['OS-0242']);
    expect(strat!.lastStatus).toBe('in_repair');
  });

  it('não mostra instrumentos de outra oficina', async () => {
    const items = ((await ctx.agent.get('/api/instruments').query({ query: 'MarcaSecreta' })).body as InstrumentListDTO).items;
    expect(items).toEqual([]);
    const otherInst = await ctx.db.selectFrom('instruments').select('id').where('workshopId', '=', 'other-workshop').executeTakeFirstOrThrow();
    expect((await ctx.agent.get(`/api/instruments/${otherInst.id}`)).status).toBe(404);
  });
});

describe('cadastros simultâneos', () => {
  it('duas contas com o mesmo e-mail ao mesmo tempo: uma entra, a outra recebe 409 (não 500)', async () => {
    const body = { workshopName: 'Oficina X', name: 'Pessoa X', email: 'mesmo@email.test', password: 'senha-forte-1' };
    const results = await Promise.all([anon().post('/api/auth/signup').send(body), anon().post('/api/auth/signup').send(body)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)!.body.error.code).toBe('email_in_use');
  });

  it('o responsável cadastrando o mesmo e-mail duas vezes ao mesmo tempo: 201 e 409', async () => {
    const body = { name: 'Lia', email: 'lia@bancada.demo', password: 'senha-inicial-1' };
    const results = await Promise.all([ctx.agent.post('/api/team').send(body), ctx.agent.post('/api/team').send(body)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });
});
