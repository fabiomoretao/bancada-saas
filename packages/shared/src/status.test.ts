import { describe, expect, it } from 'vitest';
import { availableWorkshopActions, nextStatus, WORK_ORDER_STATUSES } from './status';

describe('máquina de estados da OS', () => {
  it('segue o fluxo feliz sem peça', () => {
    expect(nextStatus('received', 'start_evaluation')).toEqual({ ok: true, to: 'evaluating' });
    expect(nextStatus('evaluating', 'publish_estimate')).toEqual({ ok: true, to: 'awaiting_approval' });
    expect(nextStatus('awaiting_approval', 'approve', { needsParts: false })).toEqual({ ok: true, to: 'in_repair' });
    expect(nextStatus('in_repair', 'complete_repair')).toEqual({ ok: true, to: 'ready_for_pickup' });
    expect(nextStatus('ready_for_pickup', 'deliver')).toEqual({ ok: true, to: 'delivered' });
  });

  it('aprovação com peça pendente vai para Aguardando peça', () => {
    expect(nextStatus('awaiting_approval', 'approve', { needsParts: true })).toEqual({ ok: true, to: 'awaiting_parts' });
    expect(nextStatus('awaiting_parts', 'register_part_arrival')).toEqual({ ok: true, to: 'in_repair' });
  });

  it('revisão volta para aguardando aprovação após nova versão', () => {
    expect(nextStatus('awaiting_approval', 'request_revision')).toEqual({ ok: true, to: 'revision_requested' });
    expect(nextStatus('revision_requested', 'publish_estimate')).toEqual({ ok: true, to: 'awaiting_approval' });
  });

  it('mudança de escopo depois da aprovação exige nova aprovação', () => {
    expect(nextStatus('in_repair', 'publish_estimate')).toEqual({ ok: true, to: 'awaiting_approval' });
    expect(nextStatus('awaiting_parts', 'publish_estimate')).toEqual({ ok: true, to: 'awaiting_approval' });
  });

  it('não permite iniciar reparo sem aprovação (critério 11)', () => {
    for (const from of WORK_ORDER_STATUSES) {
      if (from === 'awaiting_parts') continue; // única entrada legítima de Em reparo pela oficina
      expect(nextStatus(from, 'register_part_arrival').ok).toBe(false);
    }
    expect(nextStatus('awaiting_approval', 'complete_repair').ok).toBe(false);
  });

  it('estados terminais não aceitam ações', () => {
    for (const action of ['start_evaluation', 'publish_estimate', 'approve', 'deliver'] as const) {
      expect(nextStatus('delivered', action).ok).toBe(false);
      expect(nextStatus('declined', action).ok).toBe(false);
    }
  });

  it('recusa só acontece enquanto aguarda decisão', () => {
    expect(nextStatus('awaiting_approval', 'decline')).toEqual({ ok: true, to: 'declined' });
    expect(nextStatus('in_repair', 'decline').ok).toBe(false);
  });

  it('lista apenas ações válidas para a oficina', () => {
    expect(availableWorkshopActions('received')).toEqual(['start_evaluation']);
    expect(availableWorkshopActions('awaiting_approval')).toEqual([]);
    expect(availableWorkshopActions('ready_for_pickup')).toEqual(['deliver']);
  });

  it('explica o motivo quando a transição é inválida', () => {
    const result = nextStatus('awaiting_approval', 'complete_repair');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Aguardando aprovação');
  });
});
