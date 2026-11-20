import type { loginSchema, SessionDTO, signupSchema, changePasswordSchema } from '@bancada/shared';
import type { z } from 'zod';
import type { DB } from '../../db/client';
import { AppError, conflict, isUniqueViolation } from '../../lib/errors';
import { newId, nowIso } from '../../lib/ids';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../../lib/passwords';
import { createRateLimiter } from '../../lib/rate-limit';
import { generateToken, hashToken } from '../../lib/tokens';
import { findPlan } from '../workshop/workshop.service';

type SignupData = z.output<typeof signupSchema>;
type LoginData = z.output<typeof loginSchema>;
type ChangePasswordData = z.output<typeof changePasswordSchema>;

export interface AuthContext {
  userId: string;
  workshopId: string;
  role: 'owner' | 'staff';
  sessionId: string;
}

const emailInUse = () => conflict('email_in_use', 'Já existe uma conta com este e-mail. Entre ou use outro e-mail.');
const invalidLogin = () => new AppError(401, 'invalid_credentials', 'E-mail ou senha incorretos.');
export const unauthenticated = () => new AppError(401, 'unauthenticated', 'Entre na sua conta para continuar.');

/**
 * Contas e sessões. A sessão é um token aleatório num cookie httpOnly; o banco
 * guarda só o hash. Mensagens de erro de login não dizem se o e-mail existe.
 */
export function createAuthService({ db, sessionDays }: { db: DB; sessionDays: number }) {
  const loginLimiter = createRateLimiter({ max: 10, windowMs: 15 * 60_000 });
  const sessionMs = sessionDays * 86_400_000;

  async function startSession(userId: string): Promise<{ token: string; maxAgeSeconds: number }> {
    const token = generateToken();
    const now = new Date();
    await db
      .insertInto('sessions')
      .values({
        id: newId(),
        userId,
        tokenHash: hashToken(token),
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + sessionMs).toISOString(),
        lastUsedAt: now.toISOString(),
      })
      .execute();
    return { token, maxAgeSeconds: Math.floor(sessionMs / 1000) };
  }

  /** Cria a oficina e o primeiro usuário (responsável) e já entra. */
  async function signup(data: SignupData) {
    const exists = await db.selectFrom('users').select('id').where('email', '=', data.email).executeTakeFirst();
    if (exists) throw emailInUse();

    const now = nowIso();
    const workshopId = newId();
    const userId = newId();
    const passwordHash = await hashPassword(data.password);
    await db
      .transaction()
      .execute(async (trx) => {
        await trx
          .insertInto('workshops')
          .values({
            id: workshopId,
            name: data.workshopName,
            nextOrderNumber: 1,
            plan: data.plan,
            billingCycle: data.billingCycle,
            planChangedAt: now,
            createdAt: now,
          })
          .execute();
        await trx
          .insertInto('users')
          .values({
            id: userId,
            workshopId,
            name: data.name,
            email: data.email,
            passwordHash,
            role: 'owner',
            createdAt: now,
            updatedAt: now,
            disabledAt: null,
          })
          .execute();
      })
      .catch((err: unknown) => {
        // Outro cadastro com o mesmo e-mail entrou no meio do caminho.
        throw isUniqueViolation(err) ? emailInUse() : err;
      });
    return startSession(userId);
  }

  async function login(data: LoginData, clientKey: string) {
    const key = `${clientKey}|${data.email}`;
    if (!loginLimiter.hit(key)) {
      throw new AppError(429, 'too_many_attempts', 'Muitas tentativas. Aguarde 15 minutos e tente de novo.');
    }
    const user = await db
      .selectFrom('users')
      .select(['id', 'passwordHash', 'disabledAt'])
      .where('email', '=', data.email)
      .executeTakeFirst();
    // Compara mesmo sem usuário, para o tempo de resposta não revelar se o e-mail existe.
    const ok = await verifyPassword(data.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw invalidLogin();
    if (user.disabledAt) throw new AppError(403, 'user_disabled', 'Este acesso foi desativado pelo responsável da oficina.');
    loginLimiter.reset(key);
    return startSession(user.id);
  }

  /** Valida o token do cookie. Sessões expiradas ou de usuários desativados não valem. */
  async function authenticate(token: string | undefined): Promise<AuthContext | null> {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const now = nowIso();
    const row = await db
      .selectFrom('sessions as s')
      .innerJoin('users as u', 'u.id', 's.userId')
      .select(['s.id as sessionId', 's.expiresAt', 'u.id as userId', 'u.workshopId', 'u.role', 'u.disabledAt'])
      .where('s.tokenHash', '=', hashToken(token))
      .executeTakeFirst();
    if (!row || row.expiresAt <= now || row.disabledAt) return null;
    await db.updateTable('sessions').set({ lastUsedAt: now }).where('id', '=', row.sessionId).execute();
    return { userId: row.userId, workshopId: row.workshopId, role: row.role, sessionId: row.sessionId };
  }

  async function logout(sessionId: string) {
    await db.deleteFrom('sessions').where('id', '=', sessionId).execute();
  }

  async function me(ctx: AuthContext): Promise<SessionDTO> {
    const row = await db
      .selectFrom('users as u')
      .innerJoin('workshops as w', 'w.id', 'u.workshopId')
      .select(['u.id', 'u.name', 'u.email', 'u.role', 'w.id as workshopId', 'w.name as workshopName'])
      .where('u.id', '=', ctx.userId)
      .executeTakeFirstOrThrow();
    return {
      user: { id: row.id, name: row.name, email: row.email, role: row.role },
      workshop: { id: row.workshopId, name: row.workshopName, ...(await findPlan(db, row.workshopId)) },
    };
  }

  /** Troca a própria senha e encerra as outras sessões do usuário. */
  async function changePassword(ctx: AuthContext, data: ChangePasswordData) {
    const user = await db.selectFrom('users').select('passwordHash').where('id', '=', ctx.userId).executeTakeFirstOrThrow();
    if (!(await verifyPassword(data.currentPassword, user.passwordHash))) {
      throw new AppError(422, 'validation_error', 'Confira os campos destacados.', { currentPassword: 'Senha atual incorreta.' });
    }
    const passwordHash = await hashPassword(data.newPassword);
    await db.transaction().execute(async (trx) => {
      await trx.updateTable('users').set({ passwordHash, updatedAt: nowIso() }).where('id', '=', ctx.userId).execute();
      await trx.deleteFrom('sessions').where('userId', '=', ctx.userId).where('id', '!=', ctx.sessionId).execute();
    });
  }

  return { signup, login, authenticate, logout, me, changePassword };
}

export type AuthService = ReturnType<typeof createAuthService>;
