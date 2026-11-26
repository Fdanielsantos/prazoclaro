import type { SQLiteDatabase } from 'expo-sqlite';

import type { DiaPulado, ResultadoPrazo } from '@/prazos/calculo';
import type { FeriadoLocal } from '@/prazos/feriados';

// ---------- Tipos ----------

export interface Intimacao {
  id: number;
  djen_id: string | null;
  processo: string;
  tribunal: string | null;
  orgao: string | null;
  tipo: string | null;
  classe: string | null;
  texto: string;
  data_disponibilizacao: string;
  link: string | null;
  partes: string | null;
  lida: number;
  origem: 'djen' | 'manual' | 'demo';
  prazo_id?: number | null;
  tipo_documento?: string | null;
  /** JSON: Destinatario[] */
  destinatarios?: string | null;
  /** JSON: AdvogadoIntimado[] */
  advogados?: string | null;
}

export interface Destinatario {
  nome: string;
  /** "A" = polo ativo, "P" = polo passivo */
  polo?: string;
}

export interface AdvogadoIntimado {
  nome: string;
  oab?: string;
  uf?: string;
}

export type NovaIntimacao = Omit<Intimacao, 'id' | 'lida' | 'prazo_id'>;

export function lerJSON<T>(v: string | null | undefined): T[] {
  if (!v) return [];
  try {
    return JSON.parse(v) as T[];
  } catch {
    return [];
  }
}

export interface Prazo {
  id: number;
  intimacao_id: number | null;
  processo: string;
  descricao: string;
  cliente: string | null;
  dias: number;
  contagem: 'uteis' | 'corridos';
  data_disponibilizacao: string;
  data_publicacao: string;
  data_inicio: string;
  data_fim: string;
  dias_pulados: string;
  status: 'pendente' | 'cumprido';
  notif_ids: string;
  tribunal?: string | null;
  orgao?: string | null;
}

export interface Config {
  nome: string;
  oab: string;
  uf: string;
  demo: boolean;
  onboarded: boolean;
  horaAlerta: number;
  antecedencia: number; // dias antes do vencimento para o 1º alerta
  ultimaBusca: string;
}

const PADRAO: Config = {
  nome: '',
  oab: '',
  uf: '',
  demo: false,
  onboarded: false,
  horaAlerta: 9,
  antecedencia: 3,
  ultimaBusca: '',
};

// ---------- Config ----------

export async function lerConfig(db: SQLiteDatabase): Promise<Config> {
  const rows = await db.getAllAsync<{ chave: string; valor: string }>('SELECT chave, valor FROM config');
  const c: any = { ...PADRAO };
  for (const r of rows) {
    const atual = (PADRAO as any)[r.chave];
    if (typeof atual === 'boolean') c[r.chave] = r.valor === '1';
    else if (typeof atual === 'number') c[r.chave] = Number(r.valor);
    else c[r.chave] = r.valor;
  }
  return c as Config;
}

export async function salvarConfig(db: SQLiteDatabase, parcial: Partial<Config>) {
  for (const [k, v] of Object.entries(parcial)) {
    const valor = typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
    await db.runAsync('INSERT OR REPLACE INTO config (chave, valor) VALUES (?, ?)', k, valor);
  }
}

// ---------- Intimações ----------

/** Insere ignorando duplicadas (pelo djen_id). Retorna quantas eram novas. */
export async function inserirIntimacoes(db: SQLiteDatabase, itens: NovaIntimacao[]): Promise<number> {
  let novas = 0;
  await db.withTransactionAsync(async () => {
    for (const i of itens) {
      const r = await db.runAsync(
        `INSERT OR IGNORE INTO intimacoes
          (djen_id, processo, tribunal, orgao, tipo, classe, texto, data_disponibilizacao, link, partes, origem,
           tipo_documento, destinatarios, advogados)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        i.djen_id, i.processo, i.tribunal, i.orgao, i.tipo, i.classe, i.texto,
        i.data_disponibilizacao, i.link, i.partes, i.origem,
        i.tipo_documento ?? null, i.destinatarios ?? null, i.advogados ?? null,
      );
      if (r.changes === 0 && i.djen_id) {
        // Já existia: completa os campos novos de intimações importadas antes desta versão.
        await db.runAsync(
          `UPDATE intimacoes SET texto = ?, tipo_documento = COALESCE(tipo_documento, ?),
             destinatarios = COALESCE(destinatarios, ?), advogados = COALESCE(advogados, ?)
           WHERE djen_id = ?`,
          i.texto, i.tipo_documento ?? null, i.destinatarios ?? null, i.advogados ?? null, i.djen_id,
        );
      }
      novas += r.changes;
    }
  });
  return novas;
}

export async function inserirIntimacao(db: SQLiteDatabase, i: NovaIntimacao): Promise<number> {
  const r = await db.runAsync(
    `INSERT INTO intimacoes
      (djen_id, processo, tribunal, orgao, tipo, classe, texto, data_disponibilizacao, link, partes, origem)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    i.djen_id, i.processo, i.tribunal, i.orgao, i.tipo, i.classe, i.texto,
    i.data_disponibilizacao, i.link, i.partes, i.origem,
  );
  return r.lastInsertRowId;
}

export function listarIntimacoes(db: SQLiteDatabase) {
  return db.getAllAsync<Intimacao>(
    `SELECT i.*, (SELECT p.id FROM prazos p WHERE p.intimacao_id = i.id LIMIT 1) AS prazo_id
     FROM intimacoes i ORDER BY i.data_disponibilizacao DESC, i.id DESC`,
  );
}

export function obterIntimacao(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Intimacao>(
    `SELECT i.*, (SELECT p.id FROM prazos p WHERE p.intimacao_id = i.id LIMIT 1) AS prazo_id
     FROM intimacoes i WHERE i.id = ?`,
    id,
  );
}

export function marcarLida(db: SQLiteDatabase, id: number) {
  return db.runAsync('UPDATE intimacoes SET lida = 1 WHERE id = ?', id);
}

export async function contarNaoLidas(db: SQLiteDatabase) {
  const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM intimacoes WHERE lida = 0');
  return r?.n ?? 0;
}

export function excluirIntimacao(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM intimacoes WHERE id = ?', id);
}

/**
 * Remove as intimações de exemplo e os prazos criados a partir delas.
 * Retorna os IDs de notificações agendadas desses prazos, para serem cancelados.
 */
export async function removerDadosDemo(db: SQLiteDatabase): Promise<string[]> {
  const prazos = await db.getAllAsync<{ notif_ids: string }>(
    `SELECT notif_ids FROM prazos WHERE intimacao_id IN (SELECT id FROM intimacoes WHERE origem = 'demo')`,
  );
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM prazos WHERE intimacao_id IN (SELECT id FROM intimacoes WHERE origem = 'demo')`);
    await db.runAsync(`DELETE FROM intimacoes WHERE origem = 'demo'`);
  });
  return prazos.flatMap((p) => {
    try {
      return JSON.parse(p.notif_ids) as string[];
    } catch {
      return [];
    }
  });
}

/** Remove intimações importadas do DJEN que ainda não viraram prazo (ex.: ao trocar de OAB). */
export async function removerIntimacoesDJENSemPrazo(db: SQLiteDatabase) {
  const r = await db.runAsync(
    `DELETE FROM intimacoes WHERE origem = 'djen' AND id NOT IN (SELECT intimacao_id FROM prazos WHERE intimacao_id IS NOT NULL)`,
  );
  return r.changes;
}

// ---------- Prazos ----------

export async function inserirPrazo(
  db: SQLiteDatabase,
  p: { intimacao_id: number | null; processo: string; descricao: string; cliente: string | null },
  r: ResultadoPrazo,
): Promise<number> {
  const res = await db.runAsync(
    `INSERT INTO prazos
      (intimacao_id, processo, descricao, cliente, dias, contagem, data_disponibilizacao,
       data_publicacao, data_inicio, data_fim, dias_pulados)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    p.intimacao_id, p.processo, p.descricao, p.cliente, r.dias, r.contagem, r.dataDisponibilizacao,
    r.dataPublicacao, r.dataInicio, r.dataFim, JSON.stringify(r.diasPulados),
  );
  return res.lastInsertRowId;
}

const SELECT_PRAZO = `SELECT p.*, i.tribunal, i.orgao FROM prazos p LEFT JOIN intimacoes i ON i.id = p.intimacao_id`;

export function listarPrazos(db: SQLiteDatabase, status?: 'pendente' | 'cumprido') {
  if (status) {
    return db.getAllAsync<Prazo>(
      `${SELECT_PRAZO} WHERE p.status = ? ORDER BY p.data_fim ${status === 'pendente' ? 'ASC' : 'DESC'}`,
      status,
    );
  }
  return db.getAllAsync<Prazo>(`${SELECT_PRAZO} ORDER BY p.data_fim ASC`);
}

export function obterPrazo(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Prazo>(`${SELECT_PRAZO} WHERE p.id = ?`, id);
}

export function atualizarStatusPrazo(db: SQLiteDatabase, id: number, status: 'pendente' | 'cumprido') {
  return db.runAsync('UPDATE prazos SET status = ? WHERE id = ?', status, id);
}

export function salvarNotifIds(db: SQLiteDatabase, id: number, ids: string[]) {
  return db.runAsync('UPDATE prazos SET notif_ids = ? WHERE id = ?', JSON.stringify(ids), id);
}

export function excluirPrazo(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM prazos WHERE id = ?', id);
}

export function diasPuladosDe(p: Prazo): DiaPulado[] {
  try {
    return JSON.parse(p.dias_pulados);
  } catch {
    return [];
  }
}

// ---------- Feriados locais ----------

export function listarFeriadosLocais(db: SQLiteDatabase) {
  return db.getAllAsync<FeriadoLocal & { id: number; anual: any }>(
    'SELECT id, data, descricao, anual FROM feriados_locais ORDER BY substr(data, 6)',
  ).then((rows) => rows.map((r) => ({ ...r, anual: !!r.anual })));
}

export function inserirFeriadoLocal(db: SQLiteDatabase, f: FeriadoLocal) {
  return db.runAsync('INSERT INTO feriados_locais (data, descricao, anual) VALUES (?, ?, ?)', f.data, f.descricao, f.anual ? 1 : 0);
}

export function excluirFeriadoLocal(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM feriados_locais WHERE id = ?', id);
}

// ---------- Utilidades ----------

export async function apagarTudo(db: SQLiteDatabase) {
  await db.execAsync('DELETE FROM prazos; DELETE FROM intimacoes; DELETE FROM feriados_locais; DELETE FROM config;');
}
