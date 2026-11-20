import { zodResolver } from '@hookform/resolvers/zod';
import {
  cycleFromSlug,
  loginSchema,
  planFromSlug,
  PLANS,
  signupSchema,
  type BillingCycle,
  type LoginInput,
  type PlanId,
  type SignupInput,
} from '@bancada/shared';
import { useId, useState, type ReactNode } from 'react';
import { useForm, type FieldPath, type FieldValues, type Path, type UseFormRegister } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useLogin, useSession, useSignup } from '../api/hooks';
import logo from '../assets/logo-bancada.svg';
import { PlanPicker, planPriceLabel } from '../components/PlanPicker';
import { StateMessage } from '../components/StateMessage';
import styles from './AuthPages.module.css';

/** Para onde voltar depois de entrar (só caminhos internos, nunca outro site). */
function useReturnTo() {
  const [params] = useSearchParams();
  const target = params.get('voltar') ?? '';
  return target.startsWith('/') && !target.startsWith('//') ? target : '/ordens';
}

function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  wide?: boolean;
}) {
  return (
    <main className={styles.page}>
      <div className={`${styles.card} ${wide ? styles.wide : ''}`}>
        <div className={styles.brand}>
          <img src={logo} alt="" className={styles.logo} />
          <span>Bancada</span>
        </div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
        {children}
        <p className={styles.footer}>{footer}</p>
      </div>
    </main>
  );
}

function TextField<T extends FieldValues>({
  name,
  label,
  type = 'text',
  autoComplete,
  register,
  error,
  help,
}: {
  name: Path<T>;
  label: string;
  type?: string;
  autoComplete?: string;
  register: UseFormRegister<T>;
  error?: string;
  help?: string;
}) {
  const id = useId();
  const describedBy = [error && `${id}-e`, help && `${id}-h`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        className="input"
        type={type}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...register(name)}
      />
      {help && (
        <span id={`${id}-h`} className="field-help">
          {help}
        </span>
      )}
      {error && (
        <span id={`${id}-e`} className="field-error">
          {error}
        </span>
      )}
    </div>
  );
}

/** Mostra o formulário só para quem não está logado. */
function GuestOnly({ children }: { children: ReactNode }) {
  const session = useSession();
  const returnTo = useReturnTo();
  if (session.isPending) return <StateMessage kind="loading" title="Carregando…" />;
  if (session.data) return <Navigate to={returnTo} replace />;
  return <>{children}</>;
}

export function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, formState } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      await login.mutateAsync(values);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    }
  });

  return (
    <GuestOnly>
      <AuthLayout
        title="Entrar"
        subtitle="Acesse a fila da sua oficina."
        footer={
          <>
            Ainda não tem conta? <Link to="/criar-conta">Criar conta da oficina</Link>
            <span className={styles.sep} aria-hidden="true">
              ·
            </span>
            <Link to="/planos">Ver planos</Link>
          </>
        }
      >
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <TextField name="email" label="E-mail" type="email" autoComplete="email" register={register} error={formState.errors.email?.message} />
          <TextField
            name="password"
            label="Senha"
            type="password"
            autoComplete="current-password"
            register={register}
            error={formState.errors.password?.message}
          />
          {formError && (
            <p className="field-error" role="alert">
              {formError}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={login.isPending}>
            {login.isPending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </AuthLayout>
    </GuestOnly>
  );
}

export function SignupPage() {
  const signup = useSignup();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [plan, setPlan] = useState<PlanId>(() => planFromSlug(params.get('plano')) ?? 'solo');
  const [cycle, setCycle] = useState<BillingCycle>(() => cycleFromSlug(params.get('ciclo')) ?? 'monthly');
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, formState, setError } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });
  const errors = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      await signup.mutateAsync({ ...values, plan, billingCycle: cycle });
      navigate('/ordens', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'email_in_use') setError('email', { message: err.message });
      else if (err instanceof ApiError && err.code === 'validation_error') {
        for (const [path, message] of Object.entries(err.fields)) setError(path as FieldPath<SignupInput>, { message });
      } else setFormError(err instanceof Error ? err.message : 'Não foi possível criar a conta.');
    }
  });

  return (
    <GuestOnly>
      <AuthLayout
        title="Criar conta da oficina"
        subtitle="Você será o responsável pela oficina. Escolha o plano agora e troque depois, se precisar."
        wide
        footer={
          <>
            Já tem conta? <Link to="/entrar">Entrar</Link>
            <span className={styles.sep} aria-hidden="true">
              ·
            </span>
            <Link to="/planos">Comparar planos</Link>
          </>
        }
      >
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <PlanPicker plan={plan} cycle={cycle} onPlanChange={setPlan} onCycleChange={setCycle} />
          <hr className={styles.divider} />
          <TextField name="workshopName" label="Nome da oficina" autoComplete="organization" register={register} error={errors.workshopName?.message} />
          <TextField name="name" label="Seu nome" autoComplete="name" register={register} error={errors.name?.message} />
          <TextField name="email" label="E-mail" type="email" autoComplete="email" register={register} error={errors.email?.message} />
          <TextField
            name="password"
            label="Senha"
            type="password"
            autoComplete="new-password"
            register={register}
            error={errors.password?.message}
            help="Pelo menos 8 caracteres."
          />
          {formError && (
            <p className="field-error" role="alert">
              {formError}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={signup.isPending}>
            {signup.isPending ? 'Criando…' : 'Criar conta e entrar'}
          </button>
          <p className={styles.fine}>
            Plano {PLANS[plan].name}, {planPriceLabel(plan, cycle)}. Projeto acadêmico: nenhuma cobrança é feita.
          </p>
        </form>
      </AuthLayout>
    </GuestOnly>
  );
}
