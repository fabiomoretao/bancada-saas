const TZ = 'America/Sao_Paulo';

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const shortDate = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: 'numeric', month: 'short' });
const longDate = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
const time = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

const clean = (text: string) => text.replace('.', '');

/** "Hoje", "Ontem" ou "14 nov", sempre no fuso de São Paulo. */
export function relativeDay(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const today = dayKey.format(now);
  const yesterday = dayKey.format(new Date(now.getTime() - 86_400_000));
  const key = dayKey.format(date);
  if (key === today) return 'Hoje';
  if (key === yesterday) return 'Ontem';
  return clean(shortDate.format(date));
}

export const formatDate = (iso: string) => clean(longDate.format(new Date(iso)));
export const formatTime = (iso: string) => time.format(new Date(iso));
export const formatDateTime = (iso: string) => `${clean(shortDate.format(new Date(iso)))}, ${formatTime(iso)}`;

export function instrumentTitle(instrument: { type: string; brand: string | null; model: string | null }): string {
  return [instrument.type, instrument.model].filter(Boolean).join(' · ');
}

export function instrumentSubtitle(instrument: { brand: string | null; model: string | null }): string {
  return [instrument.brand, instrument.model && `Modelo ${instrument.model}`].filter(Boolean).join(' · ');
}

export const absoluteUrl = (path: string) => `${window.location.origin}${path}`;
