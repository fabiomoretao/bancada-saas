import { randomUUID } from 'node:crypto';

export const newId = (): string => randomUUID();

/** Datas sempre em ISO 8601 UTC. A conversão para America/Sao_Paulo acontece na exibição. */
export const nowIso = (): string => new Date().toISOString();

export function formatOrderCode(orderNumber: number): string {
  return `OS-${String(orderNumber).padStart(4, '0')}`;
}
