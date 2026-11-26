import type { ISODate } from './datas';

/**
 * Calendários forenses por tribunal, além dos feriados nacionais.
 *
 * Critério de inclusão: só entra o que tem fundamento legal claro para aquele
 * tribunal. Um dia não útil a mais empurra o vencimento para depois do real (o
 * erro perigoso); um dia a menos o antecipa (erro seguro). Na dúvida, fica de fora
 * e o usuário cadastra como feriado local.
 *
 * Este calendário embutido pode ser complementado por um calendário baixado
 * (ver calendarioRemoto.ts), no mesmo formato.
 */

export type RegraMovel = 'carnaval' | 'semanaSanta' | 'corpusChristi';

export interface DiaCalendario {
  /** "MM-DD" para datas anuais ou "YYYY-MM-DD" para uma data específica (ex.: suspensão por portaria). */
  data: string;
  descricao: string;
  fundamento: string;
  /** Link para o ato/portaria, quando houver. */
  link?: string;
}

export interface CalendarioTribunal {
  /** Siglas como vêm no DJEN (siglaTribunal), ex.: "TRF1", "TJSP". */
  siglas: string[];
  nome: string;
  dias: DiaCalendario[];
  moveis: RegraMovel[];
  /** Fundamento dos dias móveis (Carnaval/Semana Santa/Corpus Christi) neste tribunal. */
  fundamentoMoveis?: string;
}

export interface PacoteCalendarios {
  versao: number;
  atualizadoEm: ISODate;
  calendarios: CalendarioTribunal[];
}

const LEI_5010 = 'Lei 5.010/1966, art. 62';

export const CALENDARIO_EMBUTIDO: PacoteCalendarios = {
  versao: 1,
  atualizadoEm: '2026-11-26',
  calendarios: [
    {
      siglas: ['TRF1', 'TRF2', 'TRF3', 'TRF4', 'TRF5', 'TRF6', 'STJ', 'STF'],
      nome: 'Justiça Federal e tribunais superiores (STF/STJ)',
      dias: [
        { data: '08-11', descricao: 'Criação dos cursos jurídicos (Dia do Advogado)', fundamento: `${LEI_5010}, IV` },
        { data: '11-01', descricao: 'Dia de Todos os Santos', fundamento: `${LEI_5010}, IV` },
        { data: '12-08', descricao: 'Dia da Justiça', fundamento: `${LEI_5010}, IV` },
      ],
      moveis: ['carnaval', 'semanaSanta'],
      fundamentoMoveis: `${LEI_5010}, II e III`,
    },
    {
      siglas: ['TJSP'],
      nome: 'Tribunal de Justiça de São Paulo',
      dias: [{ data: '07-09', descricao: 'Revolução Constitucionalista', fundamento: 'Lei estadual SP 9.497/1997' }],
      moveis: [],
    },
    {
      siglas: ['TJRJ'],
      nome: 'Tribunal de Justiça do Rio de Janeiro',
      dias: [{ data: '04-23', descricao: 'Dia de São Jorge', fundamento: 'Lei estadual RJ 5.198/2008' }],
      moveis: [],
    },
    {
      siglas: ['TJRS'],
      nome: 'Tribunal de Justiça do Rio Grande do Sul',
      dias: [{ data: '09-20', descricao: 'Revolução Farroupilha (Data Magna do RS)', fundamento: 'Feriado estadual do RS' }],
      moveis: [],
    },
  ],
};

/** Calendário aplicável à sigla, combinando o embutido e o baixado (o baixado acrescenta dias). */
export function calendariosDe(sigla: string | null | undefined, extras: PacoteCalendarios | null): CalendarioTribunal[] {
  if (!sigla) return [];
  const s = sigla.toUpperCase().replace(/\s+/g, '');
  const todos = [...CALENDARIO_EMBUTIDO.calendarios, ...(extras?.calendarios ?? [])];
  return todos.filter((c) => c.siglas.some((x) => x.toUpperCase() === s));
}

/** Valida um pacote baixado; retorna null se o formato não for o esperado. */
export function validarPacote(dado: unknown): PacoteCalendarios | null {
  const p = dado as PacoteCalendarios;
  if (!p || typeof p.versao !== 'number' || !Array.isArray(p.calendarios)) return null;
  const ok = p.calendarios.every(
    (c) =>
      Array.isArray(c.siglas) &&
      c.siglas.every((s) => typeof s === 'string') &&
      Array.isArray(c.dias) &&
      c.dias.every(
        (d) =>
          typeof d.data === 'string' &&
          /^(\d{4}-)?\d{2}-\d{2}$/.test(d.data) &&
          typeof d.descricao === 'string' &&
          typeof d.fundamento === 'string',
      ) &&
      Array.isArray(c.moveis ?? []),
  );
  return ok ? { ...p, calendarios: p.calendarios.map((c) => ({ ...c, moveis: c.moveis ?? [] })) } : null;
}
