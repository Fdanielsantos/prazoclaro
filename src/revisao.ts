import Constants from 'expo-constants';
import type { SQLiteDatabase } from 'expo-sqlite';

import { atualizarCalculoPrazo, lerConfig, lerJSON, RevisaoPrazo, salvarConfig, salvarNotifIds } from '@/db/repo';
import { agendarAlertas, cancelarAlertas } from '@/notificacoes';
import { CALENDARIO_EMBUTIDO, validarPacote } from '@/prazos/calendarios';

/** Aplica o novo vencimento a um prazo salvo e reagenda os alertas. */
export async function aplicarRevisao(db: SQLiteDatabase, r: RevisaoPrazo) {
  await cancelarAlertas(lerJSON<string>(r.prazo.notif_ids));
  await atualizarCalculoPrazo(db, r.prazo.id, r.novo);
  const cfg = await lerConfig(db);
  const ids = await agendarAlertas(
    { id: r.prazo.id, processo: r.prazo.processo, descricao: r.prazo.descricao, data_fim: r.novo.dataFim },
    { hora: cfg.horaAlerta, antecedencia: cfg.antecedencia },
  );
  await salvarNotifIds(db, r.prazo.id, ids);
}

/**
 * Endereço do calendário de tribunais mantido pelo escritório (JSON no formato
 * PacoteCalendarios), configurado em app.json → expo.extra.calendarioUrl.
 * Sem endereço, o app usa só o calendário embutido.
 */
export function urlCalendario(): string | null {
  const url = (Constants.expoConfig?.extra as { calendarioUrl?: string } | undefined)?.calendarioUrl;
  return url && /^https:\/\//.test(url) ? url : null;
}

export type ResultadoAtualizacao =
  | { ok: true; versao: number; novo: boolean }
  | { ok: false; erro: string };

/** Baixa o calendário remoto e guarda se for válido e mais novo que o atual. */
export async function atualizarCalendario(db: SQLiteDatabase): Promise<ResultadoAtualizacao> {
  const url = urlCalendario();
  if (!url) return { ok: false, erro: 'Nenhum endereço de calendário configurado.' };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } }).finally(() => clearTimeout(timer));
    if (!res.ok) return { ok: false, erro: `O servidor respondeu ${res.status}.` };
    const pacote = validarPacote(await res.json());
    if (!pacote) return { ok: false, erro: 'O arquivo baixado não está no formato esperado.' };
    const cfg = await lerConfig(db);
    const atual = cfg.calendarioRemoto ? validarPacote(JSON.parse(cfg.calendarioRemoto))?.versao ?? 0 : 0;
    if (pacote.versao <= atual) return { ok: true, versao: atual, novo: false };
    await salvarConfig(db, { calendarioRemoto: JSON.stringify(pacote) });
    return { ok: true, versao: pacote.versao, novo: true };
  } catch (e: any) {
    return { ok: false, erro: e?.name === 'AbortError' ? 'Tempo esgotado.' : 'Sem conexão.' };
  }
}

/** Siglas cobertas pelo calendário (embutido + baixado), para exibir nos Ajustes. */
export function coberturaCalendario(remotoJSON: string): { siglas: string[]; versao: number; atualizadoEm: string } {
  let remoto = null;
  try {
    remoto = remotoJSON ? validarPacote(JSON.parse(remotoJSON)) : null;
  } catch {}
  const siglas = new Set<string>();
  for (const c of [...CALENDARIO_EMBUTIDO.calendarios, ...(remoto?.calendarios ?? [])]) c.siglas.forEach((s) => siglas.add(s));
  return {
    siglas: [...siglas].sort(),
    versao: remoto?.versao ?? CALENDARIO_EMBUTIDO.versao,
    atualizadoEm: remoto?.atualizadoEm ?? CALENDARIO_EMBUTIDO.atualizadoEm,
  };
}
