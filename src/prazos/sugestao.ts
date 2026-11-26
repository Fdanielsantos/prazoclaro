import { Contagem } from './calculo';

/** Prazo encontrado no texto da intimação. */
export interface CandidatoPrazo {
  dias: number;
  contagem: Contagem;
  /** Trecho do texto em que o prazo aparece. */
  trecho: string;
  /** Posição relativa no texto (0 = início, 1 = fim), para priorizar o dispositivo. */
  posicao: number;
}

export interface SugestaoPrazo {
  dias: number;
  contagem: Contagem;
  /**
   * texto: prazo lido do texto; padrao: nenhum prazo encontrado, aplicado o prazo
   * supletivo de 5 dias (CPC, art. 218, §3º); horas: prazo fixado em horas.
   */
  origem: 'texto' | 'padrao' | 'horas';
  trecho?: string;
  /** Todos os prazos em dias encontrados no texto, na ordem em que aparecem. */
  candidatos: CandidatoPrazo[];
  /** Prazo em horas encontrado no texto (o app não conta horas). */
  horas?: { quantidade: number; trecho: string };
  /** Motivo de a contagem sugerida ser em dias corridos. */
  motivoCorridos?: string;
}

/** Prazos legais mais usados, para preenchimento rápido. */
export const PRAZOS_COMUNS: { rotulo: string; dias: number; contagem: Contagem; fundamento: string; descricao: string }[] = [
  { rotulo: 'Manifestação (sem prazo fixado)', dias: 5, contagem: 'uteis', fundamento: 'CPC, art. 218, §3º', descricao: 'Manifestação nos autos' },
  { rotulo: 'Embargos de declaração', dias: 5, contagem: 'uteis', fundamento: 'CPC, art. 1.023', descricao: 'Embargos de declaração' },
  { rotulo: 'Recurso ordinário (CLT)', dias: 8, contagem: 'uteis', fundamento: 'CLT, art. 895', descricao: 'Recurso ordinário' },
  { rotulo: 'Recurso inominado (JEC)', dias: 10, contagem: 'uteis', fundamento: 'Lei 9.099/95, art. 42', descricao: 'Recurso inominado' },
  { rotulo: 'Contestação', dias: 15, contagem: 'uteis', fundamento: 'CPC, art. 335', descricao: 'Contestação' },
  { rotulo: 'Réplica', dias: 15, contagem: 'uteis', fundamento: 'CPC, arts. 350 e 351', descricao: 'Réplica à contestação' },
  { rotulo: 'Apelação', dias: 15, contagem: 'uteis', fundamento: 'CPC, art. 1.003, §5º', descricao: 'Apelação' },
  { rotulo: 'Contrarrazões', dias: 15, contagem: 'uteis', fundamento: 'CPC, art. 1.010, §1º', descricao: 'Contrarrazões' },
  { rotulo: 'Agravo de instrumento', dias: 15, contagem: 'uteis', fundamento: 'CPC, art. 1.003, §5º', descricao: 'Agravo de instrumento' },
  { rotulo: 'Agravo interno', dias: 15, contagem: 'uteis', fundamento: 'CPC, art. 1.070', descricao: 'Agravo interno' },
  { rotulo: 'REsp / RE', dias: 15, contagem: 'uteis', fundamento: 'CPC, art. 1.003, §5º', descricao: 'Recurso especial/extraordinário' },
  { rotulo: 'Pagamento voluntário', dias: 15, contagem: 'uteis', fundamento: 'CPC, art. 523', descricao: 'Pagamento voluntário' },
  { rotulo: 'Impugnação ao cumprimento', dias: 15, contagem: 'uteis', fundamento: 'CPC, art. 525', descricao: 'Impugnação ao cumprimento de sentença' },
];

// ---------- Números por extenso ----------

const UNIDADES: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, 'três': 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19,
};
const DEZENAS: Record<string, number> = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, 'cinqüenta': 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
};
const PALAVRA_NUM = `(?:${[...Object.keys(DEZENAS), ...Object.keys(UNIDADES)].sort((a, b) => b.length - a.length).join('|')})`;
const EXTENSO = `${PALAVRA_NUM}(?:\\s+e\\s+${PALAVRA_NUM})?`;

function valorExtenso(s: string): number | null {
  let total = 0;
  for (const parte of s.toLowerCase().split(/\s+e\s+/)) {
    const v = DEZENAS[parte] ?? UNIDADES[parte];
    if (v === undefined) return null;
    total += v;
  }
  return total || null;
}

// ---------- Leitura dos prazos ----------

/**
 * "no prazo de 15 (quinze) dias úteis", "em cinco dias", "prazo comum de 8 dias",
 * "dentro de 48 horas". Exige um introdutor (prazo/em/no/dentro de) para não pegar
 * menções como "há 5 dias".
 */
const RE_PRAZO = new RegExp(
  `(?:prazo(?:\\s+(?:comum|legal|sucessivo|improrrog[áa]vel|m[áa]ximo|de\\s+at[ée]))?\\s+de|prazo[^.;:]{1,40}?\\s(?:[ée]|ser[áa])\\s+de|\\b(?:em|dentro\\s+de|no\\s+m[áa]ximo\\s+em|pelo\\s+prazo\\s+de))\\s+` +
    `(\\d{1,3}|${EXTENSO})\\s*(?:\\(([^)]{2,40})\\)\\s*)?(dias?|horas?)(\\s+(?:[úu]teis|corridos|cont[íi]nuos))?`,
  'giu',
);

function trechoAoRedor(t: string, ini: number, fim: number) {
  const a = Math.max(0, ini - 50);
  const b = Math.min(t.length, fim + 30);
  return `${a > 0 ? '…' : ''}${t.slice(a, b).trim()}${b < t.length ? '…' : ''}`;
}

function contagemPadrao(texto: string, classe?: string | null): { contagem: Contagem; motivo?: string } {
  if (classe && /penal|criminal|inqu[ée]rito|habeas corpus|execu[çc][ãa]o da pena|crime/i.test(classe)) {
    return { contagem: 'corridos', motivo: `Classe criminal (${classe}): prazos contínuos (CPP, art. 798).` };
  }
  const inicio = texto.slice(0, 600).replace(/cl[áa]usula penal|multa penal/gi, '');
  if (!classe && /a[çc][ãa]o penal|processo criminal|vara criminal|juizado especial criminal/i.test(inicio)) {
    return { contagem: 'corridos', motivo: 'Processo criminal: prazos contínuos (CPP, art. 798).' };
  }
  return { contagem: 'uteis' };
}

/**
 * Sugere o prazo a partir do texto da intimação.
 *
 * Entre os prazos encontrados, sugere o MENOR: errar para menos antecipa o
 * vencimento; errar para mais faz perder o prazo. Os demais aparecem como opções.
 */
export function sugerirPrazo(texto: string, classe?: string | null): SugestaoPrazo {
  const t = texto.replace(/\s+/g, ' ');
  const padrao = contagemPadrao(t, classe);
  const candidatos: CandidatoPrazo[] = [];
  let horas: SugestaoPrazo['horas'];

  for (const m of t.matchAll(RE_PRAZO)) {
    const bruto = m[1];
    const n = /^\d+$/.test(bruto) ? Number(bruto) : valorExtenso(bruto);
    if (!n || n > 365) continue;
    const ini = m.index!;
    const trecho = trechoAoRedor(t, ini, ini + m[0].length);
    if (/^hora/i.test(m[3])) {
      horas ??= { quantidade: n, trecho };
      continue;
    }
    const qualif = (m[4] ?? '').toLowerCase();
    const contagem: Contagem = /corridos|cont[íi]nuos/.test(qualif) ? 'corridos' : /[úu]teis/.test(qualif) ? 'uteis' : padrao.contagem;
    if (!candidatos.some((c) => c.dias === n && c.contagem === contagem)) {
      candidatos.push({ dias: n, contagem, trecho, posicao: ini / Math.max(1, t.length) });
    }
  }

  if (candidatos.length) {
    const escolhido = candidatos.reduce((a, b) => (b.dias < a.dias ? b : a));
    return {
      dias: escolhido.dias,
      contagem: escolhido.contagem,
      origem: 'texto',
      trecho: escolhido.trecho,
      candidatos,
      horas,
      motivoCorridos: escolhido.contagem === 'corridos' ? padrao.motivo : undefined,
    };
  }

  if (horas) {
    // Prazo em horas conta-se de minuto a minuto (CC, art. 132, §4º): sugerimos o equivalente em dias corridos, arredondado para menos.
    return {
      dias: Math.max(1, Math.floor(horas.quantidade / 24)),
      contagem: 'corridos',
      origem: 'horas',
      trecho: horas.trecho,
      candidatos,
      horas,
    };
  }

  return { dias: 5, contagem: padrao.contagem, origem: 'padrao', candidatos, motivoCorridos: padrao.motivo };
}

/** Sugere uma descrição curta da providência a partir do texto. */
export function sugerirDescricao(texto: string): string {
  const t = texto.toLowerCase();
  if (/recurso inominado/.test(t)) return 'Recurso inominado';
  if (/embargos de declara[çc][ãa]o/.test(t) && /impugna|contrarraz|vista/.test(t)) return 'Contrarrazões aos embargos de declaração';
  if (/agravo interno/.test(t) && /impugna|contrarraz|vista/.test(t)) return 'Impugnação ao agravo interno';
  if (/contrarraz/.test(t)) return 'Contrarrazões';
  if (/apela[çc][ãa]o/.test(t) && /senten[çc]a/.test(t)) return 'Apelação';
  if (/senten[çc]a/.test(t)) return 'Ciência da sentença / recurso';
  if (/laudo/.test(t)) return 'Manifestação sobre laudo pericial';
  if (/custas/.test(t)) return 'Comprovar recolhimento de custas';
  if (/contesta[çc][ãa]o/.test(t)) return 'Réplica à contestação';
  if (/embargos/.test(t)) return 'Embargos';
  if (/pauta de julgamento|sess[ãa]o de julgamento/.test(t)) return 'Sessão de julgamento';
  if (/audi[êe]ncia/.test(t)) return 'Manifestação sobre audiência';
  if (/provas/.test(t)) return 'Especificação de provas';
  return 'Manifestação nos autos';
}

/**
 * Partes com prerrogativa de prazo em dobro (CPC, arts. 180, 183 e 186). Recebe só
 * NOMES DE PARTES (cabeçalho, destinatários) — no corpo do texto, "Estado de São
 * Paulo" aparece em qualquer endereço de comarca. Retorna os nomes, para o aviso.
 */
export function partesComPrazoEmDobro(...fontes: (string | null | undefined)[]): string[] {
  const re =
    /(?<![\p{L}])(Uni[ãa]o(?: Federal)?(?=\s*(?:\(|$|,|;|\n| e ))|Fazenda (?:P[úu]blica|Nacional|Estadual|Municipal|do Estado)(?: d[eoa] [\p{L} ]{2,25})?|Estado d[eoa] [\p{L} ]{2,25}|Munic[íi]pio d[eoa] [\p{L} ]{2,30}|Distrito Federal|INSS|Instituto Nacional do Seguro Social|Minist[ée]rio P[úu]blico(?: d[eoa] [\p{L} ]{2,30})?|Defensoria P[úu]blica(?: d[eoa] [\p{L} ]{2,30})?)(?![\p{L}])/giu;
  const achados = new Map<string, string>();
  for (const f of fontes) {
    if (!f) continue;
    for (const m of f.matchAll(re)) {
      const nome = m[1].replace(/\s+/g, ' ').trim();
      const chave = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 18);
      if (!achados.has(chave)) achados.set(chave, nome);
    }
  }
  return [...achados.values()].slice(0, 5);
}
