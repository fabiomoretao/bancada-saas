import type { createUserSchema, TeamMemberDTO, updateUserSchema } from '@bancada/shared';
import type { z } from 'zod';
import type { DB } from '../../db/client';
import { AppError, conflict, notFound } from '../../lib/errors';
import { newId, nowIso } from '../../lib/ids';
import { hashPassword } from '../../lib/passwords';
import type { AuthContext } from '../auth/auth.service';

type CreateUserData = z.output<typeof createUserSchema>;
type UpdateUserData = z.output<typeof updateUserSchema>;

/**
 * Equipe da oficina. O responsável cadastra funcionários (com uma senha
 * inicial que a pessoa troca depois), muda a função e desativa acessos.
 * A oficina sempre mantém pelo menos um responsável ativo.
 */
export function createTeamService({ db }: { db: DB }) {
  async function list(workshopId: string): Promise<TeamMemberDTO[]> {
    const rows = await db
      .selectFrom('users')
      .select(['id', 'name', 'email', 'role', 'disabledAt', 'createdAt'])
      .where('workshopId', '=', workshopId)
      .orderBy('createdAt')
      .execute();
    return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, role: r.role, active: !r.disabledAt, createdAt: r.createdAt }));
  }

  async function create(ctx: AuthContext, data: CreateUserData): Promise<TeamMemberDTO> {
    const exists = await db.selectFrom('users').select('id').where('email', '=', data.email).executeTakeFirst();
    if (exists) throw conflict('email_in_use', 'Este e-mail já tem acesso ao Bancada.');
    const now = nowIso();
    const id = newId();
    await db
      .insertInto('users')
      .values({
        id,
        workshopId: ctx.workshopId,
        name: data.name,
        email: data.email,
        passwordHash: await hashPassword(data.password),
        role: data.role,
        createdAt: now,
        updatedAt: now,
        disabledAt: null,
      })
      .execute();
    return { id, name: data.name, email: data.email, role: data.role, active: true, createdAt: now };
  }

  async function update(ctx: AuthContext, id: string, data: UpdateUserData): Promise<TeamMemberDTO> {
    const user = await db.selectFrom('users').selectAll().where('workshopId', '=', ctx.workshopId).where('id', '=', id).executeTakeFirst();
    if (!user) throw notFound('Usuário não encontrado.');

    const nextRole = data.role ?? user.role;
    const nextActive = data.active ?? !user.disabledAt;
    if (id === ctx.userId && (!nextActive || nextRole !== 'owner')) {
      throw new AppError(409, 'cannot_change_self', 'Você não pode desativar o próprio acesso nem deixar de ser responsável.');
    }
    if (user.role === 'owner' && (!nextActive || nextRole !== 'owner')) {
      const owners = await db
        .selectFrom('users')
        .select((eb) => eb.fn.countAll<number>().as('n'))
        .where('workshopId', '=', ctx.workshopId)
        .where('role', '=', 'owner')
        .where('disabledAt', 'is', null)
        .executeTakeFirstOrThrow();
      if (Number(owners.n) <= 1) throw new AppError(409, 'last_owner', 'A oficina precisa de pelo menos um responsável ativo.');
    }

    const now = nowIso();
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('users')
        .set({ role: nextRole, disabledAt: nextActive ? null : (user.disabledAt ?? now), updatedAt: now })
        .where('id', '=', id)
        .execute();
      // Acesso desativado: encerra as sessões abertas na hora.
      if (!nextActive) await trx.deleteFrom('sessions').where('userId', '=', id).execute();
    });
    return { id, name: user.name, email: user.email, role: nextRole, active: nextActive, createdAt: user.createdAt };
  }

  return { list, create, update };
}

export type TeamService = ReturnType<typeof createTeamService>;
