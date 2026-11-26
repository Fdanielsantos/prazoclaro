import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { Prazo } from '@/db/repo';
import { addDays, formatBR } from '@/prazos/datas';

/** Escapa texto para o formato iCalendar (RFC 5545). */
function esc(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

/** Quebra linhas longas (máx. 75 octetos por linha no iCalendar; aproximamos por caracteres). */
function dobrar(linha: string) {
  const partes: string[] = [];
  let resto = linha;
  while (resto.length > 70) {
    partes.push(resto.slice(0, 70));
    resto = ' ' + resto.slice(70);
  }
  partes.push(resto);
  return partes.join('\r\n');
}

const ymd = (iso: string) => iso.replace(/-/g, '');

/** Evento de dia inteiro no vencimento, com lembretes na antecedência escolhida e na véspera. */
export function gerarICS(p: Prazo, antecedencia: number): string {
  const agora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const descricao = [
    `Processo: ${p.processo}${p.tribunal ? ` (${p.tribunal})` : ''}`,
    p.cliente ? `Cliente: ${p.cliente}` : null,
    `Prazo: ${p.dias} dias ${p.contagem === 'uteis' ? 'úteis' : 'corridos'}`,
    `Disponibilização: ${formatBR(p.data_disponibilizacao)} · Publicação: ${formatBR(p.data_publicacao)} · Início: ${formatBR(p.data_inicio)}`,
    'Gerado pelo PrazoClaro. Confira a contagem.',
  ]
    .filter(Boolean)
    .join('\n');
  const alarmes = [...new Set([antecedencia, 1])].map((n) =>
    ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`Prazo vence em ${n} dia(s): ${p.descricao}`)}`, `TRIGGER:-P${n}D`, 'END:VALARM'].join('\r\n'),
  );
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PrazoClaro//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:prazo-${p.id}@prazoclaro`,
    `DTSTAMP:${agora}`,
    `DTSTART;VALUE=DATE:${ymd(p.data_fim)}`,
    `DTEND;VALUE=DATE:${ymd(addDays(p.data_fim, 1))}`,
    dobrar(`SUMMARY:${esc(`⚖️ Prazo: ${p.descricao} — ${p.processo}`)}`),
    dobrar(`DESCRIPTION:${esc(descricao)}`),
    'TRANSP:TRANSPARENT',
    ...alarmes,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

/** Gera o .ics e abre a folha de compartilhamento (Calendário, Google Agenda, Outlook...). */
export async function exportarParaAgenda(p: Prazo, antecedencia: number): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  const arquivo = new File(Paths.cache, `prazo-${p.id}.ics`);
  if (arquivo.exists) arquivo.delete();
  arquivo.create();
  arquivo.writeSync(gerarICS(p, antecedencia));
  await Sharing.shareAsync(arquivo.uri, { mimeType: 'text/calendar', UTI: 'com.apple.ical.ics', dialogTitle: 'Adicionar à agenda' });
  return true;
}
