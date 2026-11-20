import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PLANS, priceCents, yearlySavingsCents, formatPlanPrice, type SessionDTO, type WorkshopPlanDTO } from '@bancada/shared';
import { createDb } from '../src/db/client';
import { createMigrator, migrateToLatest } from '../src/db/migrator';
import { setupTestApp } from './helpers';

/** Planos Solo (1 acesso) e Equipe (até 3): valores, cadastro, limite e troca. */

type Ctx = Awaited<ReturnType<typeof setupTestApp>>;
let ctx: Ctx;

beforeEach(async () => {
  ctx = await setupTestApp();
});
afterEach(async () => {
  await ctx.db.destroy();
});

const anon = () => request(ctx.app);
let seq = 0;
const newMember = (overrides: Record<string, unknown> = {}) => ({
  name: `Pessoa ${++seq}`,
  email: `pessoa${seq}@bancada.demo`,
  password: 'senha-inicial-1',
  ...overrides,
});

async function signup(body: Record<string, unknown>) {
  const agent = request.agent(ctx.app);
  const res = await agent.post('/api/auth/signup').send({
    workshopName: 'Oficina Nova',
    name: 'Bia Souza',
    email: `bia${++seq}@nova.test`,
    password: 'senha-forte-1',
    ...body,
  });
  return { agent, res };
}

describe('tabela de preços', () => {
  it('Solo: R$ 39,90/mês ou R$ 399/ano, 1 acesso; Equipe: R$ 69,90/mês ou R$ 699/ano, até 3', () => {
    expect(PLANS.solo).toMatchObject({ maxUsers: 1, monthlyCents: 3990, yearlyCents: 39900 });
    expect(PLANS.team).toMatchObject({ maxUsers: 3, monthlyCents: 6990, yearlyCents: 69900 });
    expect(formatPlanPrice(priceCents('solo', 'monthly'))).toBe('R$ 39,90');
    expect(formatPlanPrice(priceCents('team', 'yearly'))).toBe('R$ 699');
    // O anual equivale a pagar 10 mensalidades (2 meses de economia).
    expect(yearlySavingsCents('solo')).toBe(2 * 3990);
    expect(yearlySavingsCents('team')).toBe(2 * 6990);
  });
});

describe('plano no cadastro da oficina', () => {
  it('sem escolher, a oficina começa no Solo mensal', async () => {
    const { agent, res } = await signup({});
    expect(res.status).toBe(201);
    const me = (await agent.get('/api/auth/me')).body as SessionDTO;
    expect(me.workshop).toMatchObject({ plan: 'solo', billingCycle: 'monthly', maxUsers: 1, activeUsers: 1 });
  });

  it('grava o plano e o ciclo escolhidos', async () => {
    const { agent } = await signup({ plan: 'team', billingCycle: 'yearly' });
    const plan = (await agent.get('/api/workshop/plan')).body as WorkshopPlanDTO;
    expect(plan).toEqual({ plan: 'team', billingCycle: 'yearly', maxUsers: 3, activeUsers: 1 });
  });

  it('plano desconhecido é recusado', async () => {
    const { res } = await signup({ plan: 'premium' });
    expect(res.status).toBe(422);
    expect(res.body.error.fields.plan).toBeTruthy();
  });
});

describe('limite de acessos', () => {
  it('Solo: o responsável não consegue cadastrar uma segunda pessoa', async () => {
    const { agent } = await signup({ plan: 'solo' });
    const res = await agent.post('/api/team').send(newMember());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('plan_limit');
    expect(res.body.error.message).toMatch(/plano Equipe/);
  });

  it('Equipe: aceita até 3 acessos ativos; o quarto é recusado', async () => {
    // A oficina demo está no Equipe com 2 pessoas.
    expect((await ctx.agent.post('/api/team').send(newMember())).status).toBe(201);
    const fourth = await ctx.agent.post('/api/team').send(newMember());
    expect(fourth.status).toBe(409);
    expect(fourth.body.error.code).toBe('plan_limit');
    const me = (await ctx.agent.get('/api/auth/me')).body as SessionDTO;
    expect(me.workshop.activeUsers).toBe(3);
  });

  it('desativar alguém libera a vaga; reativar com o plano cheio é recusado', async () => {
    const third = (await ctx.agent.post('/api/team').send(newMember())).body as { id: string };
    const team = (await ctx.agent.get('/api/team')).body.items as Array<{ id: string; email: string }>;
    const tecnico = team.find((u) => u.email === 'tecnico@bancada.demo')!;

    expect((await ctx.agent.patch(`/api/team/${tecnico.id}`).send({ active: false })).status).toBe(200);
    expect((await ctx.agent.post('/api/team').send(newMember())).status).toBe(201);

    const reactivate = await ctx.agent.patch(`/api/team/${tecnico.id}`).send({ active: true });
    expect(reactivate.status).toBe(409);
    expect(reactivate.body.error.code).toBe('plan_limit');

    // Desativar outra pessoa e então reativar funciona.
    expect((await ctx.agent.patch(`/api/team/${third.id}`).send({ active: false })).status).toBe(200);
    expect((await ctx.agent.patch(`/api/team/${tecnico.id}`).send({ active: true })).status).toBe(200);
  });

  it('o limite é por oficina: a outra oficina não interfere', async () => {
    const other = await ctx.loginAs('outro@oficina.test');
    expect(((await other.get('/api/workshop/plan')).body as WorkshopPlanDTO).plan).toBe('solo');
    expect((await other.post('/api/team').send(newMember())).status).toBe(409);
    expect((await ctx.agent.post('/api/team').send(newMember())).status).toBe(201);
  });
});

describe('troca de plano', () => {
  it('Solo → Equipe libera mais acessos', async () => {
    const { agent } = await signup({ plan: 'solo' });
    const res = await agent.put('/api/workshop/plan').send({ plan: 'team', billingCycle: 'yearly' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ plan: 'team', billingCycle: 'yearly', maxUsers: 3 });
    expect((await agent.post('/api/team').send(newMember())).status).toBe(201);
  });

  it('Equipe → Solo só depois de deixar 1 acesso ativo', async () => {
    const blocked = await ctx.agent.put('/api/workshop/plan').send({ plan: 'solo', billingCycle: 'monthly' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('plan_limit');
    expect(blocked.body.error.message).toMatch(/Desative 1 acesso/);
    expect(((await ctx.agent.get('/api/workshop/plan')).body as WorkshopPlanDTO).plan).toBe('team');

    const team = (await ctx.agent.get('/api/team')).body.items as Array<{ id: string; email: string }>;
    const tecnico = team.find((u) => u.email === 'tecnico@bancada.demo')!;
    await ctx.agent.patch(`/api/team/${tecnico.id}`).send({ active: false });

    const ok = await ctx.agent.put('/api/workshop/plan').send({ plan: 'solo', billingCycle: 'monthly' });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ plan: 'solo', billingCycle: 'monthly', maxUsers: 1, activeUsers: 1 });
  });

  it('mudar só o ciclo (mensal → anual) mantém o plano', async () => {
    const res = await ctx.agent.put('/api/workshop/plan').send({ plan: 'team', billingCycle: 'yearly' });
    expect(res.body).toMatchObject({ plan: 'team', billingCycle: 'yearly' });
  });

  it('técnico vê o plano, mas não pode trocar', async () => {
    const tecnico = await ctx.loginAs('tecnico@bancada.demo');
    expect((await tecnico.get('/api/workshop/plan')).status).toBe(200);
    const res = await tecnico.put('/api/workshop/plan').send({ plan: 'solo', billingCycle: 'monthly' });
    expect(res.status).toBe(403);
  });

  it('sem login não há acesso ao plano', async () => {
    expect((await anon().get('/api/workshop/plan')).status).toBe(401);
    expect((await anon().put('/api/workshop/plan').send({ plan: 'team', billingCycle: 'monthly' })).status).toBe(401);
  });

  it('ciclo inválido é recusado', async () => {
    const res = await ctx.agent.put('/api/workshop/plan').send({ plan: 'team', billingCycle: 'semanal' });
    expect(res.status).toBe(422);
  });
});

describe('migração de oficinas existentes', () => {
  it('quem já tinha mais de um acesso ativo vai para o Equipe; os demais ficam no Solo', async () => {
    const db = createDb('sqlite::memory:');
    await createMigrator(db).migrateTo('0003_users_sessions');
    const now = new Date().toISOString();
    const raw = db as unknown as import('kysely').Kysely<any>;
    for (const id of ['w-equipe', 'w-solo']) {
      await raw.insertInto('workshops').values({ id, name: id, nextOrderNumber: 1, createdAt: now }).execute();
    }
    const users = [
      ['u1', 'w-equipe', null],
      ['u2', 'w-equipe', null],
      ['u3', 'w-solo', null],
      ['u4', 'w-solo', now], // desativado não conta
    ] as const;
    for (const [id, workshopId, disabledAt] of users) {
      await raw
        .insertInto('users')
        .values({ id, workshopId, name: id, email: `${id}@x.test`, passwordHash: 'x', role: 'owner', createdAt: now, updatedAt: now, disabledAt })
        .execute();
    }

    await migrateToLatest(db);
    const rows = await db.selectFrom('workshops').select(['id', 'plan', 'billingCycle']).orderBy('id').execute();
    expect(rows).toEqual([
      { id: 'w-equipe', plan: 'team', billingCycle: 'monthly' },
      { id: 'w-solo', plan: 'solo', billingCycle: 'monthly' },
    ]);
    await db.destroy();
  });
});
