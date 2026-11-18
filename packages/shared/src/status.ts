/**
 * Máquina de estados da ordem de serviço.
 *
 * Este arquivo é a única fonte das transições permitidas. A API usa estas
 * funções para validar cada mudança; o front usa as mesmas funções apenas
 * para decidir quais ações exibir. A decisão final é sempre do servidor.
 */

export const WORK_ORDER_STATUSES = [
  'received',
  'evaluating',
  'awaiting_approval',
  'revision_requested',
  'awaiting_parts',
  'in_repair',
  'ready_for_pickup',
  'delivered',
  'declined',
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  received: 'Recebido',
  evaluating: 'Em avaliação',
  awaiting_approval: 'Aguardando aprovação',
  revision_requested: 'Revisão solicitada',
  awaiting_parts: 'Aguardando peça',
  in_repair: 'Em reparo',
  ready_for_pickup: 'Pronto para retirada',
  delivered: 'Entregue',
  declined: 'Recusada/encerrada',
};

export const TERMINAL_STATUSES: readonly WorkOrderStatus[] = ['delivered', 'declined'];

export function isWorkOrderStatus(value: unknown): value is WorkOrderStatus {
  return typeof value === 'string' && (WORK_ORDER_STATUSES as readonly string[]).includes(value);
}

export function isTerminal(status: WorkOrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Ações que a oficina solicita pela rota de transições. */
export const WORKSHOP_ACTIONS = [
  'start_evaluation',
  'register_part_arrival',
  'complete_repair',
  'deliver',
] as const;
export type WorkshopAction = (typeof WORKSHOP_ACTIONS)[number];

/** Decisões que o cliente toma pelo link privado. */
export const CUSTOMER_DECISIONS = ['approve', 'request_revision', 'decline'] as const;
export type CustomerDecision = (typeof CUSTOMER_DECISIONS)[number];

/** Publicar orçamento é uma ação própria porque cria uma versão nova. */
export type TransitionAction = WorkshopAction | CustomerDecision | 'publish_estimate';

export const ACTION_LABELS: Record<TransitionAction, string> = {
  start_evaluation: 'Iniciar avaliação',
  publish_estimate: 'Publicar orçamento',
  register_part_arrival: 'Registrar chegada da peça',
  complete_repair: 'Concluir reparo',
  deliver: 'Registrar entrega',
  approve: 'Aprovar orçamento',
  request_revision: 'Pedir revisão',
  decline: 'Recusar o serviço',
};

export interface TransitionContext {
  /** Informado no orçamento aprovado: há peça pendente de chegada? */
  needsParts?: boolean;
}

export type TransitionResult =
  | { ok: true; to: WorkOrderStatus }
  | { ok: false; reason: string };

/**
 * Estados a partir dos quais uma nova versão de orçamento pode ser publicada.
 * `awaiting_parts` e `in_repair` cobrem a mudança de escopo depois da aprovação:
 * a ordem volta a aguardar aprovação antes de executar o escopo alterado.
 */
const PUBLISHABLE_FROM: readonly WorkOrderStatus[] = [
  'evaluating',
  'revision_requested',
  'awaiting_parts',
  'in_repair',
];

export function nextStatus(
  from: WorkOrderStatus,
  action: TransitionAction,
  ctx: TransitionContext = {},
): TransitionResult {
  if (isTerminal(from)) {
    return { ok: false, reason: `A ordem está ${STATUS_LABELS[from].toLowerCase()} e não aceita novas etapas.` };
  }

  switch (action) {
    case 'start_evaluation':
      return from === 'received'
        ? { ok: true, to: 'evaluating' }
        : deny(from, action);

    case 'publish_estimate':
      return PUBLISHABLE_FROM.includes(from)
        ? { ok: true, to: 'awaiting_approval' }
        : deny(from, action);

    case 'approve':
      if (from !== 'awaiting_approval') return deny(from, action);
      return { ok: true, to: ctx.needsParts ? 'awaiting_parts' : 'in_repair' };

    case 'request_revision':
      return from === 'awaiting_approval'
        ? { ok: true, to: 'revision_requested' }
        : deny(from, action);

    case 'decline':
      return from === 'awaiting_approval'
        ? { ok: true, to: 'declined' }
        : deny(from, action);

    case 'register_part_arrival':
      return from === 'awaiting_parts'
        ? { ok: true, to: 'in_repair' }
        : deny(from, action);

    case 'complete_repair':
      return from === 'in_repair'
        ? { ok: true, to: 'ready_for_pickup' }
        : deny(from, action);

    case 'deliver':
      return from === 'ready_for_pickup'
        ? { ok: true, to: 'delivered' }
        : deny(from, action);
  }
}

/** Ações da oficina disponíveis no estado atual (para exibir só botões válidos). */
export function availableWorkshopActions(from: WorkOrderStatus): WorkshopAction[] {
  return WORKSHOP_ACTIONS.filter((action) => nextStatus(from, action).ok);
}

export function canPublishEstimate(from: WorkOrderStatus): boolean {
  return nextStatus(from, 'publish_estimate').ok;
}

function deny(from: WorkOrderStatus, action: TransitionAction): TransitionResult {
  return {
    ok: false,
    reason: `Não é possível "${ACTION_LABELS[action].toLowerCase()}" quando a ordem está em "${STATUS_LABELS[from]}".`,
  };
}
