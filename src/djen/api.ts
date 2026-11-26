import type { NovaIntimacao } from '@/db/repo';
import { addDays, hojeISO } from '@/prazos/datas';

const BASE = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';

interface ItemDJEN {
  id: number;
  data_disponibilizacao: string;
  siglaTribunal?: string;
  tipoComunicacao?: string;
  nomeOrgao?: string;
  texto?: string;
  numero_processo?: string;
  numeroprocessocommascara?: string;
  link?: string;
  nomeClasse?: string;
  destinatarios?: { nome: string; polo?: string }[];
}

const ACENTOS: Record<string, string> = { acute: '́', grave: '̀', circ: '̂', tilde: '̃', uml: '̈', cedil: '̧' };
const NOMEADAS: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ordm: 'º', ordf: 'ª', sect: '§', deg: '°',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', middot: '·',
};

function entidade(nome: string): string | null {
  if (NOMEADAS[nome]) return NOMEADAS[nome];
  const m = nome.match(/^([A-Za-z])(acute|grave|circ|tilde|uml|cedil)$/);
  return m ? (m[1] + ACENTOS[m[2]]).normalize('NFC') : null;
}

/** Remove tags HTML e entidades, normalizando espaços. */
export function limparTexto(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-zA-Z]+);/g, (orig, nome) => entidade(nome) ?? orig)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

function capitalizar(s?: string) {
  if (!s) return null;
  return s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

export function mapearItem(it: ItemDJEN): NovaIntimacao {
  return {
    djen_id: String(it.id),
    processo: it.numeroprocessocommascara || it.numero_processo || 'Sem número',
    tribunal: it.siglaTribunal ?? null,
    orgao: it.nomeOrgao ?? null,
    tipo: it.tipoComunicacao ?? null,
    classe: capitalizar(it.nomeClasse),
    texto: limparTexto(it.texto ?? ''),
    data_disponibilizacao: it.data_disponibilizacao,
    link: it.link ?? null,
    partes: it.destinatarios?.map((d) => d.nome).join(', ') || null,
    origem: 'djen',
  };
}

/** Busca as comunicações disponibilizadas para a OAB nos últimos `dias` dias. */
export async function buscarDJEN(oab: string, uf: string, dias = 30): Promise<NovaIntimacao[]> {
  const fim = hojeISO();
  const inicio = addDays(fim, -dias);
  const todos: NovaIntimacao[] = [];
  for (let pagina = 1; pagina <= 5; pagina++) {
    const params = new URLSearchParams({
      numeroOab: oab.replace(/\D/g, ''),
      ufOab: uf.toUpperCase(),
      dataDisponibilizacaoInicio: inicio,
      dataDisponibilizacaoFim: fim,
      itensPorPagina: '100',
      pagina: String(pagina),
    });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    let res: Response;
    try {
      res = await fetch(`${BASE}?${params}`, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`DJEN respondeu ${res.status}`);
    const json = (await res.json()) as { count?: number; items?: ItemDJEN[] };
    const items = json.items ?? [];
    todos.push(...items.map(mapearItem));
    if (items.length < 100 || todos.length >= (json.count ?? 0)) break;
  }
  return todos;
}
