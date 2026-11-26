// Utilitários de data trabalhando com strings ISO "YYYY-MM-DD" em UTC,
// para evitar erros de fuso horário na contagem de dias.

export type ISODate = string;

export function parseISO(d: ISODate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  const dt = parseISO(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return toISO(dt);
}

export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86400000);
}

export function hojeISO(): ISODate {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function diaSemana(d: ISODate): string {
  return DIAS_SEMANA[parseISO(d).getUTCDay()];
}

/** "25/11/2026" */
export function formatBR(d: ISODate): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

/** "25 nov" */
export function formatCurto(d: ISODate): string {
  const [, m, day] = d.split('-');
  return `${Number(day)} ${MESES[Number(m) - 1]}`;
}

/** Aceita "25/11/2026" ou "2026-11-25"; retorna ISO ou null. */
export function parseEntrada(s: string): ISODate | null {
  const t = s.trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return toISO(parseISO(iso)) === iso ? iso : null;
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return toISO(parseISO(t)) === t ? t : null;
  return null;
}
