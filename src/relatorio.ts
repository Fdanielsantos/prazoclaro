import type { Prazo } from '@/db/repo';
import { diaSemana, formatBR } from '@/prazos/datas';

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
