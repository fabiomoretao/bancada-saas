/**
 * Soma dias úteis (segunda a sexta) a uma data. Feriados não são considerados
 * no MVP. Retorna ISO 8601 em UTC.
 */
export function addBusinessDays(from: Date, days: number): string {
  const date = new Date(from);
  let added = 0;
  while (added < days) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) added++;
  }
  return date.toISOString();
}
