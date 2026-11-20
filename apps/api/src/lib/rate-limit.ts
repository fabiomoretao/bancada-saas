/**
 * Limite simples de tentativas em memória (por chave, numa janela de tempo).
 * Suficiente para um único servidor; com vários, trocar por Redis ou pelo banco.
 */
export function createRateLimiter({ max, windowMs }: { max: number; windowMs: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return {
    /** Registra uma tentativa. Retorna false se a chave passou do limite. */
    hit(key: string, now = Date.now()): boolean {
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      entry.count += 1;
      return entry.count <= max;
    },
    reset(key: string) {
      hits.delete(key);
    },
  };
}
