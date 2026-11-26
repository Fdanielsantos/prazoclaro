import { calendariosDe, PacoteCalendarios, RegraMovel } from './calendarios';
import { addDays, ISODate, parseISO, toISO } from './datas';

export type MotivoNaoUtil =
  | 'sabado'
  | 'domingo'
  | 'feriado'
  | 'feriado_local'
  | 'feriado_tribunal'
  | 'tradicional'
  | 'recesso';

export interface FeriadoLocal {
  data: ISODate; // YYYY-MM-DD
  descricao: string;
  anual?: boolean; // repete todo ano (compara só dia/mês)
}

/** Tudo o que define se um dia é útil para um prazo. */
export interface ContextoCalendario {
  /** Feriados cadastrados pelo usuário. */
  locais?: FeriadoLocal[];
  /** Sigla do tribunal do processo (ex.: "TJSP"), para aplicar o calendário dele. */
  tribunal?: string | null;
  /** Considerar Carnaval, Sexta-feira Santa e Corpus Christi como não úteis em todos os tribunais. */
  tradicionais?: boolean;
  /** Calendário baixado, que complementa o embutido. */
  extras?: PacoteCalendarios | null;
}

const LEI_662 = 'Lei 662/1949 (red. Lei 10.607/2002)';

/** Feriados nacionais declarados em lei federal. */
const NACIONAIS: { md: string; nome: string; fundamento: string; desde?: number }[] = [
  { md: '01-01', nome: 'Confraternização Universal', fundamento: LEI_662 },
  { md: '04-21', nome: 'Tiradentes', fundamento: LEI_662 },
  { md: '05-01', nome: 'Dia do Trabalho', fundamento: LEI_662 },
  { md: '09-07', nome: 'Independência do Brasil', fundamento: LEI_662 },
  { md: '10-12', nome: 'Nossa Senhora Aparecida', fundamento: 'Lei 6.802/1980' },
  { md: '11-02', nome: 'Finados', fundamento: LEI_662 },
  { md: '11-15', nome: 'Proclamação da República', fundamento: LEI_662 },
  { md: '11-20', nome: 'Dia Nacional de Zumbi e da Consciência Negra', fundamento: 'Lei 14.759/2023', desde: 2024 },
  { md: '12-25', nome: 'Natal', fundamento: LEI_662 },
];

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

/** Datas de cada regra móvel no ano. */
function datasMoveis(ano: number): Record<RegraMovel, { data: ISODate; nome: string }[]> {
  const p = pascoa(ano);
  return {
    carnaval: [
      { data: addDays(p, -48), nome: 'Carnaval (segunda-feira)' },
      { data: addDays(p, -47), nome: 'Carnaval (terça-feira)' },
    ],
    semanaSanta: [
      { data: addDays(p, -4), nome: 'Semana Santa (quarta-feira)' },
      { data: addDays(p, -3), nome: 'Semana Santa (quinta-feira)' },
      { data: addDays(p, -2), nome: 'Sexta-feira Santa' },
    ],
    corpusChristi: [{ data: addDays(p, 60), nome: 'Corpus Christi' }],
  };
}

const cacheMoveis = new Map<number, ReturnType<typeof datasMoveis>>();
function moveis(ano: number) {
  let r = cacheMoveis.get(ano);
  if (!r) cacheMoveis.set(ano, (r = datasMoveis(ano)));
  return r;
}

/** Feriados nacionais do ano (data → nome), para listagens. */
export function feriadosNacionais(ano: number): Record<ISODate, string> {
  const r: Record<ISODate, string> = {};
  for (const f of NACIONAIS) if (!f.desde || ano >= f.desde) r[`${ano}-${f.md}`] = f.nome;
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
  /** Fonte legal (ou origem) do dia não útil. */
  fundamento?: string;
}

export function infoDia(d: ISODate, ctx: ContextoCalendario = {}, considerarRecesso = true): InfoDia {
  const ano = Number(d.slice(0, 4));
  const md = d.slice(5);

  const nac = NACIONAIS.find((f) => f.md === md && (!f.desde || ano >= f.desde));
  if (nac) return { util: false, motivo: 'feriado', descricao: nac.nome, fundamento: nac.fundamento };

  const local = ctx.locais?.find((f) => (f.anual ? f.data.slice(5) === md : f.data === d));
  if (local) return { util: false, motivo: 'feriado_local', descricao: local.descricao, fundamento: 'Feriado cadastrado nos Ajustes' };

  const cals = calendariosDe(ctx.tribunal, ctx.extras ?? null);
  for (const c of cals) {
    const dia = c.dias.find((x) => x.data === md || x.data === d);
    if (dia) return { util: false, motivo: 'feriado_tribunal', descricao: dia.descricao, fundamento: dia.fundamento };
    for (const regra of c.moveis) {
      const m = moveis(ano)[regra].find((x) => x.data === d);
      if (m) return { util: false, motivo: 'feriado_tribunal', descricao: m.nome, fundamento: c.fundamentoMoveis ?? c.nome };
    }
  }

  if (ctx.tradicionais) {
    for (const regra of ['carnaval', 'corpusChristi'] as const) {
      const m = moveis(ano)[regra].find((x) => x.data === d);
      if (m) return { util: false, motivo: 'tradicional', descricao: m.nome, fundamento: 'Ponto facultativo, considerado por opção nos Ajustes' };
    }
    if (moveis(ano).semanaSanta[2].data === d) {
      return { util: false, motivo: 'tradicional', descricao: 'Sexta-feira Santa', fundamento: 'Feriado religioso (Lei 9.093/1995), considerado por opção nos Ajustes' };
    }
  }

  if (considerarRecesso && emRecesso(d)) {
    return { util: false, motivo: 'recesso', descricao: 'Recesso forense', fundamento: 'CPC, art. 220' };
  }
  const dow = parseISO(d).getUTCDay();
  if (dow === 6) return { util: false, motivo: 'sabado', descricao: 'Sábado', fundamento: 'CPC, art. 216' };
  if (dow === 0) return { util: false, motivo: 'domingo', descricao: 'Domingo', fundamento: 'CPC, art. 216' };
  return { util: true };
}
