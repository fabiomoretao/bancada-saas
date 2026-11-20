import {
  accessLabel,
  BILLING_CYCLES,
  BILLING_CYCLE_LABELS,
  formatPlanPrice,
  PLAN_IDS,
  PLANS,
  priceCents,
  yearlyPerMonthCents,
  type BillingCycle,
  type PlanId,
} from '@bancada/shared';
import { useId } from 'react';
import styles from './PlanPicker.module.css';

/** "R$ 39,90/mês" ou "R$ 399/ano". */
export function planPriceLabel(plan: PlanId, cycle: BillingCycle): string {
  return `${formatPlanPrice(priceCents(plan, cycle))}/${cycle === 'monthly' ? 'mês' : 'ano'}`;
}

/** Alternância Mensal | Anual. O anual equivale a 2 meses grátis nos dois planos. */
export function CycleToggle({ value, onChange, label = 'Forma de pagamento' }: { value: BillingCycle; onChange: (c: BillingCycle) => void; label?: string }) {
  const name = useId();
  return (
    <fieldset className={styles.toggle}>
      <legend className="visually-hidden">{label}</legend>
      {BILLING_CYCLES.map((cycle) => (
        <label key={cycle} className={styles.toggleOption}>
          <input type="radio" name={name} value={cycle} checked={value === cycle} onChange={() => onChange(cycle)} />
          <span>
            {BILLING_CYCLE_LABELS[cycle]}
            {cycle === 'yearly' && <small className={styles.save}>2 meses grátis</small>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Escolha de plano em formato compacto (cadastro da oficina e troca de plano).
 * `unavailable` desabilita um plano e mostra o motivo, por exemplo quando a
 * oficina tem mais acessos ativos do que o plano permite.
 */
export function PlanPicker({
  plan,
  cycle,
  onPlanChange,
  onCycleChange,
  current,
  unavailable = {},
  legend = 'Plano',
}: {
  plan: PlanId;
  cycle: BillingCycle;
  onPlanChange: (plan: PlanId) => void;
  onCycleChange: (cycle: BillingCycle) => void;
  current?: { plan: PlanId; billingCycle: BillingCycle };
  unavailable?: Partial<Record<PlanId, string>>;
  legend?: string;
}) {
  const name = useId();
  return (
    <div className={styles.picker}>
      <CycleToggle value={cycle} onChange={onCycleChange} />
      <fieldset className={styles.options}>
        <legend className="field-label">{legend}</legend>
        {PLAN_IDS.map((id) => {
          const info = PLANS[id];
          const reason = unavailable[id];
          const isCurrent = current?.plan === id && current.billingCycle === cycle;
          return (
            <label key={id} className={styles.option} data-disabled={reason ? true : undefined}>
              <input
                type="radio"
                name={name}
                value={id}
                checked={plan === id}
                disabled={Boolean(reason)}
                onChange={() => onPlanChange(id)}
                aria-describedby={reason ? `${name}-${id}-motivo` : undefined}
              />
              <span className={styles.optionBody}>
                <span className={styles.optionHead}>
                  <strong>{info.name}</strong>
                  {isCurrent && <span className={styles.current}>Plano atual</span>}
                  <span className={styles.price}>{planPriceLabel(id, cycle)}</span>
                </span>
                <span className={styles.optionMeta}>
                  {accessLabel(info.maxUsers)}
                  {cycle === 'yearly' && ` · equivale a ${formatPlanPrice(yearlyPerMonthCents(id))}/mês`}
                </span>
                {reason && (
                  <span id={`${name}-${id}-motivo`} className={styles.reason}>
                    {reason}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}
