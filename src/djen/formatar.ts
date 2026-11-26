/**
 * Organiza o teor de uma intimação do DJEN para leitura.
 *
 * O texto chega em dois formatos: um bloco corrido (cabeçalho, partes e decisão
 * emendados, sem quebras de linha, comum no PJe) ou HTML com tabelas/seções
 * (eproc/e-SAJ/STJ), já convertido em texto por `limparTexto`. Aqui separamos
 * o cabeçalho (rótulo: valor), o título do ato (DECISÃO, DESPACHO...) e o corpo
 * em parágrafos, e marcamos trechos a destacar (prazos, datas, cominações).
 */

export interface CampoCabecalho {
  rotulo: string;
  valor: string;
}

export interface TeorEstruturado {
  /** Título do ato, ex.: "Decisão interlocutória". */
  titulo: string | null;
  /** Campos do cabeçalho (partes, advogados, relator...), sem nº do processo e classe. */
  cabecalho: CampoCabecalho[];
  paragrafos: string[];
}

export type TipoDestaque = 'prazo' | 'data' | 'pena' | 'comando';
export interface Trecho {
  texto: string;
  destaque?: TipoDestaque;
}

// ---------- Cabeçalho ----------

const ROTULOS = [
  'Número do processo', 'PROCESSO N\\.?º?', 'PROCESSO', 'Processo', 'Classe judicial', 'CLASSE', 'Classe', 'Assunto',
  'Órgão julgador', 'REPRESENTANTES POLO ATIVO', 'REPRESENTANTES POLO PASSIVO', 'POLO ATIVO', 'POLO PASSIVO',
  'REQUERENTES?', 'REQUERID[OA]S?', 'AUTOR(?:A|ES|\\(A\\))?', 'RÉ(?:U|US)?(?:\\(S\\))?', 'EXEQUENTES?', 'EXECUTAD[OA]S?',
  'AGRAVANTES?', 'AGRAVAD[OA]S?', 'EMBARGANTES?', 'EMBARGAD[OA]S?', 'APELANTES?', 'APELAD[OA]S?', 'IMPETRANTES?',
  'IMPETRAD[OA]S?', 'RECORRENTES?', 'RECORRID[OA]S?', 'RECLAMANTES?', 'RECLAMAD[OA]S?', 'INTERESSAD[OA]S?',
  'TERCEIRO INTERESSADO', 'ADVOGAD[OA]S?(?:\\(A\\))?', 'PROCURADOR(?:A|ES)?', 'RELATORA?', 'INVESTIGAD[OA]', 'DENUNCIAD[OA]',
  'VÍTIMA', 'TESTEMUNHA', 'Intimad[oa]',
];
// Rótulo no início de palavra seguido de ":" (aceita espaços/quebras entre eles).
const RE_ROTULO = new RegExp(`(?<![\\p{L}])(${ROTULOS.join('|')})\\s*:`, 'gu');
const ROTULOS_REDUNDANTES = /^(número do processo|processo|classe)/i;

const TITULOS = [
  'DECISÃO INTERLOCUTÓRIA', 'DECISÃO MONOCRÁTICA', 'DECISÃO', 'DESPACHO', 'SENTENÇA(?: TIPO [A-Z])?', 'ACÓRDÃO', 'EMENTA',
  'ATO ORDINATÓRIO', 'CERTIDÃO', 'EDITAL(?: \\(DJEN\\))?(?: DE [A-ZÇÃÕÁÉÍÓÚÂÊÔ ]{3,40}?(?= COM| [A-Z][a-z]|[.:]))?',
  'INTIMAÇÃO', 'MANDADO', 'PAUTA DE JULGAMENTO', 'CITAÇÃO',
];
const RE_TITULO = new RegExp(`(?<![\\p{L}])(${TITULOS.join('|')})(?![\\p{L}])(\\s*\\([^)]{0,80}\\))?`, 'gu');

function limparValor(v: string) {
  return v
    .split('\n')
    .map((l) => l.replace(/^\s*:\s*/, '').trim())
    .filter(Boolean)
    .join('\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function capitalizarTitulo(t: string) {
  const s = t.replace(/\s+/g, ' ').trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------- Parágrafos ----------

const ABREVIACOES = new Set([
  'art', 'arts', 'des', 'dr', 'dra', 'drs', 'sr', 'sra', 'min', 'rel', 'fl', 'fls', 'n', 'nº', 'no', 'inc', 'p', 'pág', 'id',
  'exmo', 'exma', 'ltda', 'cia', 'av', 'proc', 'adv', 'obs', 'ex', 'eg', 'v', 'vs', 'res', 'cf', 'súm', 'sum', 'al',
]);

/** Marcadores que costumam abrir um novo parágrafo em decisões. */
const RE_INICIO_PARAGRAFO =
  /^(Ante o exposto|Diante do exposto|Pelo exposto|Isso posto|Isto posto|Posto isso|Diante disso|Assim|Dessa forma|Desse modo|Por fim|Por outro lado|No caso|Na hipótese|Nesse sentido|Com efeito|Decido|DECIDO|É o (?:breve )?relatório|Relatados|Trata-se|Cuida-se|Defiro|Indefiro|Intime-se|Intimem-se|Cite-se|Citem-se|Cumpra-se|Publique-se|P\.\s?R\.\s?I|Após|Em seguida|Outrossim|Fica[m]? a[s]? parte|Documento assinado|[A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{3,}, (?:DF, )?\d{1,2} de [a-zç]+ de \d{4})/;

function dividirFrases(texto: string): string[] {
  const frases: string[] = [];
  let inicio = 0;
  const re = /[.!?;:](?=\s+["“(]?[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    if (m[0] === '.' ) {
      const antes = texto.slice(inicio, m.index).match(/([\p{L}º]+)$/u)?.[1] ?? '';
      // Abreviações ("art.", "Des.") e iniciais ("L. M. S.") não encerram frase.
      if (antes.length === 1 || ABREVIACOES.has(antes.toLowerCase())) continue;
    } else if (m[0] === ';' || m[0] === ':') {
      continue; // só servem para quebra quando seguidos de marcador (tratado abaixo)
    }
    frases.push(texto.slice(inicio, m.index + 1).trim());
    inicio = m.index + 1;
  }
  const resto = texto.slice(inicio).trim();
  if (resto) frases.push(resto);
  return frases.filter(Boolean);
}

/** Agrupa frases de um bloco corrido em parágrafos de leitura confortável. */
function paragrafar(bloco: string, alvo = 420): string[] {
  const paragrafos: string[] = [];
  let atual = '';
  for (const frase of dividirFrases(bloco)) {
    const novoParagrafo = RE_INICIO_PARAGRAFO.test(frase) || atual.length >= alvo;
    if (atual && novoParagrafo) {
      paragrafos.push(atual);
      atual = frase;
    } else {
      atual = atual ? `${atual} ${frase}` : frase;
    }
  }
  if (atual) paragrafos.push(atual);
  return paragrafos;
}

function corpoEmParagrafos(corpo: string): string[] {
  // Texto vindo de HTML já tem quebras; o bloco corrido não tem nenhuma.
  const blocos = corpo
    .split(/\n+/)
    .map((b) => b.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return blocos.flatMap((b) => (b.length > 600 ? paragrafar(b) : [b]));
}

// ---------- Estrutura ----------

export function estruturarTeor(texto: string): TeorEstruturado {
  const t = texto.replace(/ /g, ' ').trim();
  const janela = t.slice(0, 2500);

  // Rótulos do cabeçalho na parte inicial do texto
  const rotulos = [...janela.matchAll(RE_ROTULO)].map((m) => ({ rotulo: m[1], ini: m.index!, fim: m.index! + m[0].length }));

  // Título do ato: o primeiro que aparece depois do início do último rótulo
  // (evita confundir "CUMPRIMENTO DE SENTENÇA" da classe com o título).
  const aPartir = rotulos.length ? rotulos[rotulos.length - 1].fim : 0;
  const limite = rotulos.length ? janela.length : 400;
  let titulo: { texto: string; ini: number; fim: number } | null = null;
  for (const m of janela.matchAll(RE_TITULO)) {
    if (m.index! < aPartir || m.index! > limite) continue;
    titulo = { texto: m[0], ini: m.index!, fim: m.index! + m[0].length };
    break;
  }

  if (!titulo) {
    // Sem título do ato: no texto vindo de HTML (com quebras) o cabeçalho é a
    // sequência inicial de linhas "RÓTULO : valor"; no bloco corrido não dá
    // para saber onde ele termina, então mantemos o texto todo.
    return t.includes('\n') ? cabecalhoPorLinhas(t) : { titulo: null, cabecalho: [], paragrafos: corpoEmParagrafos(t) };
  }

  const cabecalho: CampoCabecalho[] = [];
  rotulos.forEach((r, i) => {
    const fimValor = i + 1 < rotulos.length ? rotulos[i + 1].ini : titulo!.ini;
    if (fimValor <= r.fim) return;
    const valor = limparValor(t.slice(r.fim, fimValor));
    if (!valor || ROTULOS_REDUNDANTES.test(r.rotulo)) return;
    const rotulo = capitalizarTitulo(r.rotulo);
    const anterior = cabecalho[cabecalho.length - 1];
    if (anterior && anterior.rotulo === rotulo) anterior.valor += `\n${valor}`;
    else cabecalho.push({ rotulo, valor });
  });

  const corpo = t.slice(titulo.fim).replace(/^[\s.:–-]+/, '');
  return { titulo: formatarTitulo(titulo.texto), cabecalho, paragrafos: corpoEmParagrafos(corpo) };
}

/** "ATO ORDINATÓRIO (DEPÓSITO DE RPV)" → "Ato ordinatório (depósito de RPV)"; "EDITAL (DJEN)" → "Edital". */
function formatarTitulo(bruto: string) {
  const s = bruto.replace(/\s*\(DJEN\)/, '');
  const [principal, ...resto] = s.split('(');
  const base = capitalizarTitulo(principal);
  if (!resto.length) return base;
  const comp = resto
    .join('(')
    .replace(/\)$/, '')
    .split(/(\s+|\/)/)
    .map((w) => (/^[A-Z]{2,4}$/.test(w) ? w : w.toLowerCase()))
    .join('');
  return `${base} (${comp.trim()})`;
}

const RE_LINHA_ROTULO = new RegExp(`^(${ROTULOS.join('|')})\\s*:\\s*(.*)$`, 'u');

function cabecalhoPorLinhas(t: string): TeorEstruturado {
  const linhas = t.split('\n').map((l) => l.trim()).filter(Boolean);
  const cabecalho: CampoCabecalho[] = [];
  let titulo: string | null = null;
  let i = 0;
  // Uma linha curta antes dos rótulos identifica o feito (ex.: "AgInt no REsp 2291185/SC").
  if (linhas.length > 1 && linhas[0].length <= 90 && !RE_LINHA_ROTULO.test(linhas[0]) && RE_LINHA_ROTULO.test(linhas[1])) {
    titulo = linhas[0];
    i = 1;
  }
  for (; i < linhas.length; i++) {
    const m = linhas[i].match(RE_LINHA_ROTULO);
    if (m) {
      const rotulo = capitalizarTitulo(m[1]);
      const anterior = cabecalho[cabecalho.length - 1];
      if (anterior && anterior.rotulo === rotulo) anterior.valor += `\n${m[2]}`;
      else cabecalho.push({ rotulo, valor: m[2] });
      continue;
    }
    // Linha de continuação (ex.: segundo advogado): curta e sem cara de frase.
    const ultimo = cabecalho[cabecalho.length - 1];
    if (ultimo && linhas[i].length <= 100 && !/[a-zà-ú]{4,}\s+[a-zà-ú]{3,}/.test(linhas[i])) {
      ultimo.valor += `\n${linhas[i].replace(/^:\s*/, '')}`;
      continue;
    }
    break;
  }
  if (!cabecalho.length) return { titulo: null, cabecalho: [], paragrafos: corpoEmParagrafos(t) };
  return {
    titulo,
    cabecalho: cabecalho.filter((c) => !ROTULOS_REDUNDANTES.test(c.rotulo)),
    paragrafos: corpoEmParagrafos(linhas.slice(i).join('\n')),
  };
}

/** Uma linha de resumo para a lista: o título do ato e o começo do corpo. */
export function resumoTeor(texto: string, tipoDocumento?: string | null, max = 170): string {
  const { titulo, paragrafos } = estruturarTeor(texto);
  const corpo = paragrafos.join(' ');
  const rotulo = tipoDocumento && tipoDocumento.length <= 40 ? tipoDocumento : titulo;
  const inicio = corpo.length > max ? corpo.slice(0, max).replace(/\s+\S*$/, '') + '…' : corpo;
  return rotulo ? `${rotulo} · ${inicio}` : inicio;
}

// ---------- Destaques ----------

const RE_DESTAQUE = new RegExp(
  [
    // prazos: "no prazo de 15 (quinze) dias úteis", "5 dias", "48 horas"
    '(?<prazo>(?:(?:no |em |dentro do |pelo )?prazo(?: comum| legal| sucessivo)? de )?\\d{1,3}\\s*(?:\\([^)]{2,30}\\)\\s*)?(?:dias?|horas)(?: (?:úteis|uteis|corridos))?)',
    // datas e horários
    '(?<data>\\d{1,2}/\\d{1,2}/\\d{2,4}(?:,? (?:às|as) \\d{1,2}(?::\\d{2}|h\\d{0,2})(?: ?horas)?)?|\\d{1,2} de (?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro) de \\d{4})',
    // cominações
    '(?<pena>sob (?:a )?pena de [^.;]{3,120})',
    // comandos
    '(?<comando>(?<![\\p{L}])(?:Intime-se|Intimem-se|Cite-se|Citem-se|Cumpra-se|Publique-se|Manifeste-se|Manifestem-se|Especifiquem|Comprove|Recolha|Junte|Junte-se|Designo|Defiro|Indefiro|JULGO (?:PROCEDENTES?|IMPROCEDENTES?|PARCIALMENTE PROCEDENTES?|PROCEDENTE EM PARTE|EXTINT[OA])[^.;,]{0,40})(?![\\p{L}]))',
  ].join('|'),
  'giu',
);

export function destacar(paragrafo: string): Trecho[] {
  const out: Trecho[] = [];
  let pos = 0;
  for (const m of paragrafo.matchAll(RE_DESTAQUE)) {
    const g = m.groups ?? {};
    const tipo = (['prazo', 'data', 'pena', 'comando'] as const).find((k) => g[k]);
    if (!tipo) continue;
    if (m.index! > pos) out.push({ texto: paragrafo.slice(pos, m.index) });
    out.push({ texto: m[0], destaque: tipo });
    pos = m.index! + m[0].length;
  }
  if (pos < paragrafo.length) out.push({ texto: paragrafo.slice(pos) });
  return out;
}

/** Frases que pedem providência (prazo, cominação, audiência), para o quadro "Pontos de atenção". */
export function pontosDeAtencao(texto: string, max = 3): string[] {
  const { paragrafos } = estruturarTeor(texto);
  const frases = paragrafos.flatMap(dividirFrases);
  const relevantes = [
    ...new Set(
      frases.filter((f) =>
        /prazo(?: comum| legal| sucessivo)? de \d|no prazo legal|\d+\s*(?:\([^)]*\)\s*)?dias|sob pena|audiência|sessão de julgamento|pauta de julgamento|designo/i.test(
          f,
        ),
      ),
    ),
  ];
  // As providências ficam no dispositivo, no fim do texto: ficamos com as últimas, na ordem original.
  return relevantes.slice(-max).map((f) => (f.length > 320 ? f.slice(0, 320).replace(/\s+\S*$/, '') + '…' : f));
}
