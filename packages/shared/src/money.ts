/**
 * Valores monetários trafegam e são armazenados como centavos inteiros.
 * Conversões para reais acontecem só na borda (formulário e exibição).
 */

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatCents(cents: number): string {
  return brl.format(cents / 100);
}

/** Converte "42,50", "42.50" ou 42.5 em 4250. Retorna null se inválido. */
export function toCents(value: string | number): number | null {
  let normalized: number;
  if (typeof value === 'number') {
    normalized = value;
  } else {
    const text = value.trim();
    if (text === '') return null;
    // Com vírgula, o ponto é separador de milhar ("1.234,56"); sem vírgula, é decimal ("42.50").
    normalized = text.includes(',') ? Number(text.replace(/\./g, '').replace(',', '.')) : Number(text);
  }
  if (!Number.isFinite(normalized) || normalized < 0) return null;
  return Math.round(normalized * 100);
}

export interface LineInput {
  quantity: number;
  unitPriceCents: number;
}

export function lineTotalCents(line: LineInput): number {
  return line.quantity * line.unitPriceCents;
}

export function totalCents(lines: readonly LineInput[]): number {
  return lines.reduce((sum, line) => sum + lineTotalCents(line), 0);
}
