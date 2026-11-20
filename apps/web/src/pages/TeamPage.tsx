import { zodResolver } from '@hookform/resolvers/zod';
import { KeyIcon, UserPlusIcon, UsersIcon } from '@phosphor-icons/react';
import {
  accessLabel,
  BILLING_CYCLE_LABELS,
  changePasswordSchema,
  createUserSchema,
  PLAN_IDS,
  PLANS,
  ROLE_LABELS,
  type BillingCycle,
  type PlanId,
  type WorkshopPlanDTO,
  type ChangePasswordInput,
  type CreateUserInput,
  type TeamMemberDTO,
} from '@bancada/shared';
import { useId, useState } from 'react';
import { useForm, type FieldPath } from 'react-hook-form';
import { ApiError } from '../api/client';
import { Link } from 'react-router-dom';
import { useChangePassword, useChangePlan, useCreateMember, usePlan, useSession, useTeam, useUpdateMember } from '../api/hooks';
import { Dialog } from '../components/Dialog';
import { PlanPicker, planPriceLabel } from '../components/PlanPicker';
import { TableSkeleton } from '../components/Loading';
import { StateMessage } from '../components/StateMessage';
import { useToast } from '../components/Toast';
import { formatDate } from '../lib/format';
import styles from './TeamPage.module.css';

/** Equipe da oficina: quem tem acesso, cadastro de funcionários e troca da própria senha. */
export function TeamPage() {
  const session = useSession();
  const team = useTeam();
  const plan = usePlan();
  const isOwner = session.data?.user.role === 'owner';
  const [adding, setAdding] = useState(false);
  const full = plan.data ? plan.data.activeUsers >= plan.data.maxUsers : false;

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <div className="eyebrow">{session.data?.workshop.name}</div>
          <h1 className={styles.title}>Equipe</h1>
          <p className={styles.subtitle}>
            Quem tem acesso ao Bancada desta oficina.{' '}
            {isOwner ? 'Como responsável, você cadastra e desativa acessos.' : 'Só o responsável cadastra e desativa acessos.'}
          </p>
        </div>
        {isOwner && !adding && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setAdding(true)}
            disabled={full}
            aria-describedby={full ? 'plano-cheio' : undefined}
          >
            <UserPlusIcon size={18} aria-hidden="true" /> Adicionar pessoa
          </button>
        )}
      </div>

      {plan.data && <PlanSection plan={plan.data} isOwner={isOwner} />}

      {adding && !full && <AddMemberForm onDone={() => setAdding(false)} />}

      <section className={`surface ${styles.card}`} aria-labelledby="equipe-lista">
        <h2 id="equipe-lista" className={styles.cardTitle}>
          Acessos
        </h2>
        {team.isPending ? (
          <TableSkeleton label="Carregando equipe…" />
        ) : team.isError ? (
          <StateMessage kind="error" title="Não foi possível carregar a equipe">
            {team.error.message}
          </StateMessage>
        ) : (
          <div className={styles.tableBox}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Pessoa</th>
                  <th scope="col">Função</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Desde</th>
                  {isOwner && <th scope="col">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {team.data.items.map((member) => (
                  <MemberRow key={member.id} member={member} isOwner={isOwner} isSelf={member.id === session.data?.user.id} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ChangePasswordForm />
    </>
  );
}

function MemberRow({ member, isOwner, isSelf }: { member: TeamMemberDTO; isOwner: boolean; isSelf: boolean }) {
  const update = useUpdateMember();
  const toast = useToast();
  const [confirmingDisable, setConfirmingDisable] = useState(false);

  async function change(input: { role?: 'owner' | 'staff'; active?: boolean }, message: string) {
    try {
      await update.mutateAsync({ id: member.id, ...input });
      setConfirmingDisable(false);
      toast(message);
    } catch (err) {
      setConfirmingDisable(false);
      toast(err instanceof Error ? err.message : 'Não foi possível alterar.');
    }
  }

  return (
    <tr data-inactive={!member.active || undefined}>
      <td>
        <strong>
          {member.name}
          {isSelf && <span className={styles.you}> (você)</span>}
        </strong>
        <small>{member.email}</small>
      </td>
      <td data-label="Função">{ROLE_LABELS[member.role]}</td>
      <td data-label="Situação">{member.active ? 'Ativo' : 'Desativado'}</td>
      <td data-label="Desde">{formatDate(member.createdAt)}</td>
      {isOwner && (
        <td data-label="Ações" data-actions={isSelf ? 'none' : undefined}>
          {isSelf ? (
            <span className={styles.muted}>—</span>
          ) : (
            <div className={styles.rowActions}>
              {member.active && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={update.isPending}
                  onClick={() =>
                    change(
                      { role: member.role === 'owner' ? 'staff' : 'owner' },
                      member.role === 'owner' ? `${member.name} agora é técnico` : `${member.name} agora é responsável`,
                    )
                  }
                >
                  {member.role === 'owner' ? 'Tornar técnico' : 'Tornar responsável'}
                </button>
              )}
              <button
                type="button"
                className={`btn btn-ghost ${member.active ? styles.danger : ''}`}
                disabled={update.isPending}
                onClick={() => (member.active ? setConfirmingDisable(true) : change({ active: true }, 'Acesso reativado'))}
              >
                {member.active ? 'Desativar' : 'Reativar'}
              </button>
              <Dialog
                open={confirmingDisable}
                title={`Desativar o acesso de ${member.name}?`}
                confirmLabel="Desativar acesso"
                tone="danger"
                busy={update.isPending}
                onConfirm={() => change({ active: false }, 'Acesso desativado')}
                onClose={() => setConfirmingDisable(false)}
              >
                <p>A pessoa sai na hora e não consegue mais entrar. O histórico das ordens continua com o nome dela, e você pode reativar depois.</p>
              </Dialog>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}

/** Plano atual, acessos em uso e troca de plano (só o responsável troca). */
function PlanSection({ plan, isOwner }: { plan: WorkshopPlanDTO; isOwner: boolean }) {
  const [changing, setChanging] = useState(false);
  const info = PLANS[plan.plan];
  const full = plan.activeUsers >= plan.maxUsers;
  const used = Math.min(plan.activeUsers, plan.maxUsers);

  return (
    <section className={`surface ${styles.card} ${styles.planCard}`} aria-labelledby="plano-atual">
      <div className={styles.planInfo}>
        <h2 id="plano-atual" className={styles.cardTitle}>
          <UsersIcon size={20} aria-hidden="true" /> Plano {info.name}
          <span className={styles.planCycle}>{BILLING_CYCLE_LABELS[plan.billingCycle]}</span>
        </h2>
        <p className={styles.planPrice}>
          {planPriceLabel(plan.plan, plan.billingCycle)} · {accessLabel(info.maxUsers)}
        </p>
        <div className={styles.meter}>
          <div
            className={styles.meterBar}
            role="meter"
            aria-label="Acessos em uso"
            aria-valuemin={0}
            aria-valuemax={plan.maxUsers}
            aria-valuenow={plan.activeUsers}
            aria-valuetext={`${plan.activeUsers} de ${plan.maxUsers}`}
          >
            <span style={{ width: `${(used / plan.maxUsers) * 100}%` }} />
          </div>
          <span className={styles.meterText}>
            <strong>
              {plan.activeUsers} de {plan.maxUsers}
            </strong>{' '}
            {plan.maxUsers === 1 ? 'acesso em uso' : 'acessos em uso'}
          </span>
        </div>
        {full && (
          <p id="plano-cheio" className={styles.planHint}>
            {plan.plan === 'solo'
              ? 'O plano Solo inclui 1 acesso. Para cadastrar mais pessoas, mude para o plano Equipe.'
              : 'Todos os acessos do plano estão em uso. Desative um acesso para liberar a vaga.'}
          </p>
        )}
      </div>
      <div className={styles.planActions}>
        {isOwner ? (
          <button type="button" className="btn" onClick={() => setChanging(true)}>
            Mudar plano
          </button>
        ) : (
          <span className={styles.planHint}>Só o responsável muda o plano.</span>
        )}
        <Link to="/planos" className={styles.planLink}>
          Comparar planos
        </Link>
      </div>
      {isOwner && <ChangePlanDialog open={changing} plan={plan} onClose={() => setChanging(false)} />}
    </section>
  );
}

function ChangePlanDialog({ open, plan, onClose }: { open: boolean; plan: WorkshopPlanDTO; onClose: () => void }) {
  const change = useChangePlan();
  const toast = useToast();
  const [selected, setSelected] = useState<PlanId>(plan.plan);
  const [cycle, setCycle] = useState<BillingCycle>(plan.billingCycle);
  const [error, setError] = useState('');

  // Planos que não comportam os acessos ativos de hoje.
  const unavailable: Partial<Record<PlanId, string>> = {};
  for (const id of PLAN_IDS) {
    const extra = plan.activeUsers - PLANS[id].maxUsers;
    if (extra > 0) {
      unavailable[id] = `A oficina tem ${plan.activeUsers} acessos ativos. Desative ${extra} na lista da equipe antes de mudar para este plano.`;
    }
  }

  function close() {
    setSelected(plan.plan);
    setCycle(plan.billingCycle);
    setError('');
    onClose();
  }

  async function confirm() {
    if (selected === plan.plan && cycle === plan.billingCycle) return close();
    setError('');
    try {
      await change.mutateAsync({ plan: selected, billingCycle: cycle });
      toast(`Plano alterado para ${PLANS[selected].name} (${BILLING_CYCLE_LABELS[cycle].toLowerCase()}).`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível mudar o plano.');
    }
  }

  return (
    <Dialog open={open} title="Mudar plano" confirmLabel="Confirmar plano" busy={change.isPending} error={error} onConfirm={confirm} onClose={close}>
      <p>Os dois planos têm as mesmas funções; muda o número de acessos. A troca vale na hora.</p>
      <PlanPicker
        plan={selected}
        cycle={cycle}
        onPlanChange={setSelected}
        onCycleChange={setCycle}
        current={plan}
        unavailable={unavailable}
        legend="Novo plano"
      />
    </Dialog>
  );
}

function AddMemberForm({ onDone }: { onDone: () => void }) {
  const create = useCreateMember();
  const toast = useToast();
  const ids = { name: useId(), email: useId(), password: useId(), role: useId() };
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, formState, setError } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: 'staff' },
  });
  const errors = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      await create.mutateAsync(values);
      toast('Pessoa adicionada. Passe o e-mail e a senha inicial para ela.');
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'email_in_use') setError('email', { message: err.message });
      else if (err instanceof ApiError && err.code === 'validation_error') {
        for (const [path, message] of Object.entries(err.fields)) setError(path as FieldPath<CreateUserInput>, { message });
      } else setFormError(err instanceof Error ? err.message : 'Não foi possível adicionar.');
    }
  });

  return (
    <section className={`surface ${styles.card}`} aria-labelledby="nova-pessoa">
      <h2 id="nova-pessoa" className={styles.cardTitle}>
        Adicionar pessoa
      </h2>
      <p className={styles.muted}>Defina uma senha inicial; a pessoa pode trocá-la depois em Equipe › Minha senha.</p>
      <form className={styles.grid} onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor={ids.name} className="field-label">
            Nome
          </label>
          <input id={ids.name} className="input" autoComplete="off" aria-invalid={errors.name ? true : undefined} {...register('name')} />
          {errors.name && <span className="field-error">{errors.name.message}</span>}
        </div>
        <div className="field">
          <label htmlFor={ids.email} className="field-label">
            E-mail de acesso
          </label>
          <input id={ids.email} className="input" type="email" autoComplete="off" aria-invalid={errors.email ? true : undefined} {...register('email')} />
          {errors.email && <span className="field-error">{errors.email.message}</span>}
        </div>
        <div className="field">
          <label htmlFor={ids.password} className="field-label">
            Senha inicial
          </label>
          <input
            id={ids.password}
            className="input"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.password ? true : undefined}
            {...register('password')}
          />
          {errors.password ? <span className="field-error">{errors.password.message}</span> : <span className="field-help">Pelo menos 8 caracteres.</span>}
        </div>
        <div className="field">
          <label htmlFor={ids.role} className="field-label">
            Função
          </label>
          <select id={ids.role} className="input" {...register('role')}>
            <option value="staff">Técnico — usa a fila, orçamentos e clientes</option>
            <option value="owner">Responsável — também gerencia a equipe</option>
          </select>
        </div>
        {formError && (
          <p className={`field-error ${styles.full}`} role="alert">
            {formError}
          </p>
        )}
        <div className={`${styles.formActions} ${styles.full}`}>
          <button type="button" className="btn" onClick={onDone}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Adicionando…' : 'Adicionar'}
          </button>
        </div>
      </form>
    </section>
  );
}

function ChangePasswordForm() {
  const change = useChangePassword();
  const toast = useToast();
  const ids = { current: useId(), next: useId() };
  const { register, handleSubmit, formState, setError, reset } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });
  const errors = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await change.mutateAsync(values);
      reset({ currentPassword: '', newPassword: '' });
      toast('Senha alterada. Outras sessões abertas foram encerradas.');
    } catch (err) {
      if (err instanceof ApiError && err.fields.currentPassword) setError('currentPassword', { message: err.fields.currentPassword });
      else toast(err instanceof Error ? err.message : 'Não foi possível alterar a senha.');
    }
  });

  return (
    <section className={`surface ${styles.card}`} aria-labelledby="minha-senha">
      <h2 id="minha-senha" className={styles.cardTitle}>
        <KeyIcon size={20} aria-hidden="true" /> Minha senha
      </h2>
      <form className={styles.grid} onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor={ids.current} className="field-label">
            Senha atual
          </label>
          <input
            id={ids.current}
            className="input"
            type="password"
            autoComplete="current-password"
            aria-invalid={errors.currentPassword ? true : undefined}
            {...register('currentPassword')}
          />
          {errors.currentPassword && <span className="field-error">{errors.currentPassword.message}</span>}
        </div>
        <div className="field">
          <label htmlFor={ids.next} className="field-label">
            Nova senha
          </label>
          <input
            id={ids.next}
            className="input"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.newPassword ? true : undefined}
            {...register('newPassword')}
          />
          {errors.newPassword ? <span className="field-error">{errors.newPassword.message}</span> : <span className="field-help">Pelo menos 8 caracteres.</span>}
        </div>
        <div className={`${styles.formActions} ${styles.full}`}>
          <button type="submit" className="btn" disabled={change.isPending}>
            {change.isPending ? 'Salvando…' : 'Alterar senha'}
          </button>
        </div>
      </form>
    </section>
  );
}
