/**
 * Planos de assinatura. Valores em centavos, como todo dinheiro do sistema.
 * Os dois planos têm as mesmas funções; muda só o número de acessos.
 *
 * Projeto acadêmico: a escolha do plano é registrada e o limite de acessos é
 * aplicado pela API, mas nenhuma cobrança é feita.
 */

export const PLAN_IDS = ['solo', 'team'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const BILLING_CYCLES = ['monthly', 'yearly'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Acessos ativos (logins) permitidos na oficina. */
  maxUsers: number;
  monthlyCents: number;
  yearlyCents: number;
}

export const PLANS: Record<PlanId, Plan> = {
  solo: {
    id: 'solo',
    name: 'Solo',
    tagline: 'Para quem trabalha sozinho na bancada.',
    maxUsers: 1,
    monthlyCents: 3990,
    yearlyCents: 39900,
  },
  team: {
    id: 'team',
    name: 'Equipe',
    tagline: 'Para oficinas com mais gente no balcão e na bancada.',
    maxUsers: 3,
    monthlyCents: 6990,
    yearlyCents: 69900,
  },
};

/** O que os dois planos incluem (a diferença é só o número de acessos). */
export const PLAN_FEATURES: readonly string[] = [
  'Ordens de serviço ilimitadas',
  'Clientes e instrumentos ilimitados',
  'Orçamento com versões e aprovação pelo link',
  'Link privado de acompanhamento para o cliente',
  'Histórico completo de cada OS',
];

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = { monthly: 'Mensal', yearly: 'Anual' };

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && (PLAN_IDS as readonly string[]).includes(value);
}

export function priceCents(plan: PlanId, cycle: BillingCycle): number {
  return cycle === 'monthly' ? PLANS[plan].monthlyCents : PLANS[plan].yearlyCents;
}

/** Quanto se economiza no ano pagando anual em vez de 12 mensalidades. */
export function yearlySavingsCents(plan: PlanId): number {
  return PLANS[plan].monthlyCents * 12 - PLANS[plan].yearlyCents;
}

/** Valor anual dividido por 12, arredondado ao centavo. */
export function yearlyPerMonthCents(plan: PlanId): number {
  return Math.round(PLANS[plan].yearlyCents / 12);
}

export function accessLabel(maxUsers: number): string {
  return maxUsers === 1 ? '1 acesso' : `até ${maxUsers} acessos`;
}

/** "R$ 39,90" ou "R$ 399" (sem centavos quando o valor é inteiro). */
export function formatPlanPrice(cents: number): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

/** Valores aceitos na URL da página de planos e do cadastro (?plano=solo&ciclo=anual). */
export const PLAN_SLUGS: Record<PlanId, string> = { solo: 'solo', team: 'equipe' };
export const CYCLE_SLUGS: Record<BillingCycle, string> = { monthly: 'mensal', yearly: 'anual' };

export function planFromSlug(slug: string | null | undefined): PlanId | null {
  const found = PLAN_IDS.find((id) => PLAN_SLUGS[id] === slug);
  return found ?? null;
}

export function cycleFromSlug(slug: string | null | undefined): BillingCycle | null {
  const found = BILLING_CYCLES.find((c) => CYCLE_SLUGS[c] === slug);
  return found ?? null;
}
