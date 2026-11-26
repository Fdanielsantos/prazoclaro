import { Contagem } from './calculo';

export interface SugestaoPrazo {
  dias: number;
  contagem: Contagem;
  trecho?: string; // trecho do texto que originou a sugestão
}

/** Sugere uma descrição curta da providência a partir do texto. */
export function sugerirDescricao(texto: string): string {
  const t = texto.toLowerCase();
  if (/recurso inominado/.test(t)) return 'Recurso inominado';
  if (/apela[çc][ãa]o/.test(t) && /senten[çc]a/.test(t)) return 'Apelação';
  if (/senten[çc]a/.test(t)) return 'Ciência da sentença / recurso';
  if (/laudo/.test(t)) return 'Manifestação sobre laudo pericial';
  if (/custas/.test(t)) return 'Comprovar recolhimento de custas';
  if (/contesta[çc][ãa]o/.test(t)) return 'Réplica à contestação';
  if (/embargos/.test(t)) return 'Embargos';
  if (/audi[êe]ncia/.test(t)) return 'Manifestação sobre audiência';
  if (/provas/.test(t)) return 'Especificação de provas';
  return 'Manifestação nos autos';
}

/** Tenta extrair o prazo do texto da intimação (ex.: "no prazo de 15 (quinze) dias"). */
export function sugerirPrazo(texto: string): SugestaoPrazo {
  const t = texto.replace(/\s+/g, ' ');
  const re = /prazo(?:\s+comum)?(?:\s+\w+)?\s+de\s+(\d{1,3})\s*(?:\([^)]*\))?\s*(dias?\s*(?:úteis|uteis|corridos)?|horas)/i;
  const m = t.match(re);
  const corridos = /dias\s+corridos/i.test(t) || /penal|criminal/i.test(t.slice(0, 600));
  if (m && !/horas/i.test(m[2])) {
    const start = Math.max(0, (m.index ?? 0) - 40);
    return {
      dias: Number(m[1]),
      contagem: /corridos/i.test(m[2]) || corridos ? 'corridos' : 'uteis',
      trecho: '…' + t.slice(start, (m.index ?? 0) + m[0].length + 20).trim() + '…',
    };
  }
  return { dias: 15, contagem: corridos ? 'corridos' : 'uteis' };
}
