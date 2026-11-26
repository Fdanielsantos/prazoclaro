import { diasPuladosDe, type Prazo } from '@/db/repo';
import type { DiaPulado } from '@/prazos/calculo';
import { diaSemana, formatBR } from '@/prazos/datas';

/** Agrupa dias seguidos com o mesmo motivo ("20/12/2026 a 20/01/2027: recesso forense (CPC, art. 220)"). */
export function agruparDiasNaoUteis(dias: DiaPulado[], incluirFimDeSemana = false): string[] {
  const lista = dias
    .filter((d) => incluirFimDeSemana || (d.motivo !== 'sabado' && d.motivo !== 'domingo'))
    .sort((a, b) => a.data.localeCompare(b.data));
  const grupos: { ini: string; fim: string; d: DiaPulado }[] = [];
  for (const d of lista) {
    const g = grupos[grupos.length - 1];
    // Recesso é contínuo: os feriados dentro dele (Natal, 1º/1) não interrompem o período.
    if (g && g.d.motivo === 'recesso' && d.data <= `${Number(g.ini.slice(0, 4)) + 1}-01-20` && (d.motivo === 'recesso' || d.motivo === 'feriado')) {
      g.fim = d.data;
      continue;
    }
    grupos.push({ ini: d.data, fim: d.data, d });
  }
  return grupos.map(({ ini, fim, d }) => {
    const periodo = ini === fim ? formatBR(ini) : `${formatBR(ini)} a ${formatBR(fim)}`;
    return `${periodo}: ${d.descricao.toLowerCase()}${d.fundamento ? ` (${d.fundamento})` : ''}`;
  });
}

/** Tópico "Da tempestividade" pronto para colar na petição. */
export function textoTempestividade(p: Prazo): string {
  const uteis = p.contagem === 'uteis';
  const naoUteis = agruparDiasNaoUteis(diasPuladosDe(p));
  const fds = diasPuladosDe(p).filter((d) => d.motivo === 'sabado' || d.motivo === 'domingo').length;
  const partes = [
    'DA TEMPESTIVIDADE',
    '',
    `A intimação foi disponibilizada no Diário de Justiça Eletrônico Nacional (DJEN) em ${formatBR(p.data_disponibilizacao)} (${diaSemana(p.data_disponibilizacao)}), ` +
      `considerando-se publicada no primeiro dia útil subsequente, ${formatBR(p.data_publicacao)} (${diaSemana(p.data_publicacao)}), ` +
      'nos termos do art. 4º, § 3º, da Lei nº 11.419/2006 e do art. 224, § 2º, do Código de Processo Civil.',
    '',
    `A contagem do prazo de ${p.dias} (${extenso(p.dias)}) dias ${uteis ? 'úteis' : 'corridos'}` +
      `${uteis ? ', na forma do art. 219 do CPC,' : ''} iniciou-se em ${formatBR(p.data_inicio)} (art. 224, § 3º, do CPC) ` +
      `e encerra-se em ${formatBR(p.data_fim)} (${diaSemana(p.data_fim)}).`,
  ];
  if (uteis && (naoUteis.length || fds)) {
    partes.push(
      '',
      `Foram excluídos da contagem${fds ? ` os sábados e domingos (art. 216 do CPC)` : ''}${naoUteis.length ? `${fds ? ' e ' : ' '}os seguintes dias não úteis:` : '.'}`,
      ...naoUteis.map((l) => `• ${l};`),
    );
  }
  partes.push('', 'Tempestiva, portanto, a presente manifestação.');
  return partes.join('\n');
}

const EXT = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
function extenso(n: number): string {
  if (n < 20) return EXT[n];
  if (n < 100) return DEZ[Math.floor(n / 10)] + (n % 10 ? ` e ${EXT[n % 10]}` : '');
  return String(n);
}

/** Gera um texto em linguagem simples para enviar ao cliente (WhatsApp/e-mail). */
export function relatorioCliente(p: Prazo, advogado: string): string {
  const saud = p.cliente ? `Olá, ${p.cliente.split(' ')[0]}! Tudo bem?` : 'Olá! Tudo bem?';
  const status =
    p.status === 'cumprido'
      ? '✅ Essa providência já foi cumprida pelo escritório.'
      : '🗓️ Já estamos cuidando disso e o prazo está devidamente controlado.';
  return [
    saud,
    '',
    `Passando para atualizar sobre o seu processo nº ${p.processo}${p.tribunal ? ` (${p.tribunal})` : ''}.`,
    '',
    `📌 O que aconteceu: o juízo publicou uma nova movimentação, que exige a seguinte providência: ${p.descricao.toLowerCase()}.`,
    '',
    `⏳ Prazo: ${p.dias} dias ${p.contagem === 'uteis' ? 'úteis' : 'corridos'}, com vencimento em ${diaSemana(p.data_fim)}, ${formatBR(p.data_fim)}.`,
    '',
    status,
    '',
    'Se precisarmos de algum documento ou informação sua, entraremos em contato. Qualquer dúvida, estou à disposição.',
    '',
    advogado ? `Atenciosamente,\n${advogado}` : 'Atenciosamente.',
  ].join('\n');
}
