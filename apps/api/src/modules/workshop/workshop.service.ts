import { PLANS, type changePlanSchema, type PlanId, type WorkshopPlanDTO } from '@bancada/shared';
import type { z } from 'zod';
import type { DB } from '../../db/client';
import type { Database } from '../../db/schema';
import type { Kysely, Transaction } from 'kysely';
import { AppError, notFound } from '../../lib/errors';
import { nowIso } from '../../lib/ids';

type ChangePlanData = z.output<typeof changePlanSchema>;
type Executor = Kysely<Database> | Transaction<Database>;

/** Acessos ativos da oficina (usuários não desativados). */
export async function countActiveUsers(db: Executor, workshopId: string): Promise<number> {
  const row = await db
    .selectFrom('users')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('workshopId', '=', workshopId)
    .where('disabledAt', 'is', null)
    .executeTakeFirstOrThrow();
  return Number(row.n);
}

export async function findPlan(db: Executor, workshopId: string): Promise<WorkshopPlanDTO> {
  const workshop = await db
    .selectFrom('workshops')
    .select(['plan', 'billingCycle'])
    .where('id', '=', workshopId)
    .executeTakeFirst();
  if (!workshop) throw notFound('Oficina não encontrada.');
  return {
    plan: workshop.plan,
    billingCycle: workshop.billingCycle,
    maxUsers: PLANS[workshop.plan].maxUsers,
    activeUsers: await countActiveUsers(db, workshopId),
  };
}

/** Erro padrão quando a oficina já usa todos os acessos do plano. */
export function planLimitReached(plan: PlanId): AppError {
  const { name, maxUsers } = PLANS[plan];
  return new AppError(
    409,
    'plan_limit',
    plan === 'solo'
      ? `O plano ${name} inclui ${maxUsers} acesso. Mude para o plano Equipe para cadastrar mais pessoas.`
      : `O plano ${name} inclui até ${maxUsers} acessos e todos estão em uso. Desative um acesso para liberar a vaga.`,
  );
}

/**
 * Plano da oficina. Não há cobrança neste projeto acadêmico: a troca é
 * registrada na hora. Diminuir o plano só é permitido se os acessos ativos
 * couberem no plano novo.
 */
export function createWorkshopService({ db }: { db: DB }) {
  async function getPlan(workshopId: string): Promise<WorkshopPlanDTO> {
    return findPlan(db, workshopId);
  }

  async function changePlan(workshopId: string, data: ChangePlanData): Promise<WorkshopPlanDTO> {
    return db.transaction().execute(async (trx) => {
      const current = await findPlan(trx, workshopId);
      const target = PLANS[data.plan];
      if (current.activeUsers > target.maxUsers) {
        const extra = current.activeUsers - target.maxUsers;
        throw new AppError(
          409,
          'plan_limit',
          `O plano ${target.name} inclui ${target.maxUsers} acesso${target.maxUsers > 1 ? 's' : ''} e a oficina tem ${current.activeUsers} ativos. ` +
            `Desative ${extra} acesso${extra > 1 ? 's' : ''} na equipe antes de mudar.`,
        );
      }
      if (current.plan !== data.plan || current.billingCycle !== data.billingCycle) {
        await trx
          .updateTable('workshops')
          .set({ plan: data.plan, billingCycle: data.billingCycle, planChangedAt: nowIso() })
          .where('id', '=', workshopId)
          .execute();
      }
      return { ...current, plan: data.plan, billingCycle: data.billingCycle, maxUsers: target.maxUsers };
    });
  }

  return { getPlan, changePlan };
}

export type WorkshopService = ReturnType<typeof createWorkshopService>;
