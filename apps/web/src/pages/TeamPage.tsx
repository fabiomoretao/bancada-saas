import { zodResolver } from '@hookform/resolvers/zod';
import { KeyIcon, UserPlusIcon } from '@phosphor-icons/react';
import {
  changePasswordSchema,
  createUserSchema,
  ROLE_LABELS,
  type ChangePasswordInput,
  type CreateUserInput,
  type TeamMemberDTO,
} from '@bancada/shared';
import { useId, useState } from 'react';
import { useForm, type FieldPath } from 'react-hook-form';
import { ApiError } from '../api/client';
import { useChangePassword, useCreateMember, useSession, useTeam, useUpdateMember } from '../api/hooks';
import { StateMessage } from '../components/StateMessage';
import { useToast } from '../components/Toast';
import { formatDate } from '../lib/format';
import styles from './TeamPage.module.css';

/** Equipe da oficina: quem tem acesso, cadastro de funcionários e troca da própria senha. */
export function TeamPage() {
  const session = useSession();
  const team = useTeam();
  const isOwner = session.data?.user.role === 'owner';
  const [adding, setAdding] = useState(false);

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
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <UserPlusIcon size={18} aria-hidden="true" /> Adicionar pessoa
          </button>
        )}
      </div>

      {adding && <AddMemberForm onDone={() => setAdding(false)} />}

      <section className={`surface ${styles.card}`} aria-labelledby="equipe-lista">
        <h2 id="equipe-lista" className={styles.cardTitle}>
          Acessos
        </h2>
        {team.isPending ? (
          <StateMessage kind="loading" title="Carregando equipe…" />
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

  async function change(input: { role?: 'owner' | 'staff'; active?: boolean }, message: string) {
    if (input.active === false && !window.confirm(`Desativar o acesso de ${member.name}? A pessoa sai na hora e não consegue entrar.`)) return;
    try {
      await update.mutateAsync({ id: member.id, ...input });
      toast(message);
    } catch (err) {
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
      <td>{ROLE_LABELS[member.role]}</td>
      <td>{member.active ? 'Ativo' : 'Desativado'}</td>
      <td>{formatDate(member.createdAt)}</td>
      {isOwner && (
        <td>
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
                onClick={() => change({ active: !member.active }, member.active ? 'Acesso desativado' : 'Acesso reativado')}
              >
                {member.active ? 'Desativar' : 'Reativar'}
              </button>
            </div>
          )}
        </td>
      )}
    </tr>
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
