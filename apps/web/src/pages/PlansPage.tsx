import { CheckIcon, UsersIcon } from '@phosphor-icons/react';
import {
  accessLabel,
  CYCLE_SLUGS,
  cycleFromSlug,
  formatPlanPrice,
  PLAN_FEATURES,
  PLAN_IDS,
  PLAN_SLUGS,
  PLANS,
  priceCents,
  yearlyPerMonthCents,
  yearlySavingsCents,
  type BillingCycle,
  type PlanId,
} from '@bancada/shared';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSession } from '../api/hooks';
import logo from '../assets/logo-bancada.svg';
import { CycleToggle } from '../components/PlanPicker';
import styles from './PlansPage.module.css';

/** Página pública de planos: Solo (1 acesso) e Equipe (até 3), mensal ou anual. */
export function PlansPage() {
  const [params, setParams] = useSearchParams();
  // Estado local responde ao clique na hora; a URL guarda a escolha para compartilhar o link.
  const [cycle, setCycleState] = useState<BillingCycle>(() => cycleFromSlug(params.get('ciclo')) ?? 'monthly');
  const session = useSession();
  const signedIn = Boolean(session.data);

  function setCycle(next: BillingCycle) {
    setCycleState(next);
    setParams(next === 'monthly' ? {} : { ciclo: CYCLE_SLUGS[next] }, { replace: true });
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          <img src={logo} alt="" className={styles.logo} />
          <span>Bancada</span>
        </Link>
        <nav aria-label="Conta" className={styles.headerLinks}>
          {signedIn ? (
            <Link to="/ordens" className="btn">
              Ir para a fila
            </Link>
          ) : (
            <>
              <Link to="/entrar" className="btn btn-ghost">
                Entrar
              </Link>
              <Link to="/criar-conta" className="btn">
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className={styles.main}>
        <div className={styles.intro}>
          <div className="eyebrow">Planos</div>
          <h1 className={styles.title}>Um preço simples para a sua oficina</h1>
          <p className={styles.subtitle}>Os dois planos têm todas as funções do Bancada. Muda só quantas pessoas acessam.</p>
          <CycleToggle value={cycle} onChange={setCycle} />
        </div>

        <div className={styles.cards}>
          {PLAN_IDS.map((id) => (
            <PlanCard key={id} id={id} cycle={cycle} signedIn={signedIn} />
          ))}
        </div>

        <p className={styles.note}>
          Valores em reais. Dá para trocar de plano depois, na tela Equipe.
          <br />
          Projeto acadêmico: a escolha do plano é registrada, mas nenhuma cobrança é feita.
        </p>
      </main>
    </div>
  );
}

function PlanCard({ id, cycle, signedIn }: { id: PlanId; cycle: BillingCycle; signedIn: boolean }) {
  const plan = PLANS[id];
  const titleId = `plano-${id}`;
  const signupPath = `/criar-conta?plano=${PLAN_SLUGS[id]}&ciclo=${CYCLE_SLUGS[cycle]}`;

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.cardTitle}>
        {plan.name}
      </h2>
      <p className={styles.tagline}>{plan.tagline}</p>

      <p className={styles.price}>
        <strong>{formatPlanPrice(priceCents(id, cycle))}</strong>
        <span>/{cycle === 'monthly' ? 'mês' : 'ano'}</span>
      </p>
      <p className={styles.priceNote}>
        {cycle === 'monthly'
          ? `ou ${formatPlanPrice(plan.yearlyCents)}/ano (2 meses grátis)`
          : `equivale a ${formatPlanPrice(yearlyPerMonthCents(id))}/mês · economia de ${formatPlanPrice(yearlySavingsCents(id))} no ano`}
      </p>

      <p className={styles.access}>
        <UsersIcon size={20} aria-hidden="true" />
        <span>
          <strong>{accessLabel(plan.maxUsers)}</strong>
          {plan.maxUsers === 1 ? ' — um login para a oficina' : ' — cada pessoa com o próprio login'}
        </span>
      </p>

      <ul className={styles.features}>
        {PLAN_FEATURES.map((feature) => (
          <li key={feature}>
            <CheckIcon size={16} weight="bold" aria-hidden="true" />
            {feature}
          </li>
        ))}
        {plan.maxUsers > 1 && (
          <li>
            <CheckIcon size={16} weight="bold" aria-hidden="true" />
            Responsável e técnicos com permissões diferentes
          </li>
        )}
      </ul>

      {signedIn ? (
        <Link to="/equipe" className={`btn ${styles.cta}`}>
          Ver meu plano
        </Link>
      ) : (
        <Link to={signupPath} className={`btn btn-primary ${styles.cta}`} aria-label={`Começar com o plano ${plan.name}`}>
          Começar com o {plan.name}
        </Link>
      )}
    </section>
  );
}
