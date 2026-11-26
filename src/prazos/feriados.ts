import { addDays, ISODate, parseISO, toISO } from './datas';

export type MotivoNaoUtil = 'sabado' | 'domingo' | 'feriado' | 'feriado_local' | 'recesso';

export interface FeriadoLocal {
  data: ISODate; // YYYY-MM-DD
  descricao: string;
  anual?: boolean; // repete todo ano (compara só dia/mês)
}

const FIXOS: Record<string, string> = {
  '01-01': 'Confraternização Universal',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalho',
  '09-07': 'Independência do Brasil',
  '10-12': 'Nossa Senhora Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '11-20': 'Dia da Consciência Negra',
  '12-25': 'Natal',
};

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): ISODate {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return toISO(new Date(Date.UTC(ano, mes - 1, dia)));
}

const cacheMoveis = new Map<number, Record<ISODate, string>>();

export function feriadosNacionais(ano: number): Record<ISODate, string> {
  const cached = cacheMoveis.get(ano);
  if (cached) return cached;
  const p = pascoa(ano);
  const r: Record<ISODate, string> = {};
  for (const [md, nome] of Object.entries(FIXOS)) r[`${ano}-${md}`] = nome;
  r[addDays(p, -48)] = 'Carnaval (segunda)';
  r[addDays(p, -47)] = 'Carnaval (terça)';
  r[addDays(p, -2)] = 'Sexta-feira Santa';
  r[addDays(p, 60)] = 'Corpus Christi';
  cacheMoveis.set(ano, r);
  return r;
}

/** Recesso forense: 20/12 a 20/01, inclusive (CPC, art. 220). */
export function emRecesso(d: ISODate): boolean {
  const md = d.slice(5);
  return md >= '12-20' || md <= '01-20';
}

export interface InfoDia {
  util: boolean;
  motivo?: MotivoNaoUtil;
  descricao?: string;
}

export function infoDia(d: ISODate, locais: FeriadoLocal[] = [], considerarRecesso = true): InfoDia {
  const dow = parseISO(d).getUTCDay();
  const nac = feriadosNacionais(Number(d.slice(0, 4)))[d];
  if (nac) return { util: false, motivo: 'feriado', descricao: nac };
  const local = locais.find((f) => (f.anual ? f.data.slice(5) === d.slice(5) : f.data === d));
  if (local) return { util: false, motivo: 'feriado_local', descricao: local.descricao };
  if (considerarRecesso && emRecesso(d)) return { util: false, motivo: 'recesso', descricao: 'Recesso forense (CPC, art. 220)' };
  if (dow === 6) return { util: false, motivo: 'sabado', descricao: 'Sábado' };
  if (dow === 0) return { util: false, motivo: 'domingo', descricao: 'Domingo' };
  return { util: true };
}
