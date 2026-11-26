import type { SQLiteDatabase } from 'expo-sqlite';

export const DB_NAME = 'prazoclaro.db';

export async function migrar(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS config (
      chave TEXT PRIMARY KEY NOT NULL,
      valor TEXT
    );
    CREATE TABLE IF NOT EXISTS intimacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      djen_id TEXT UNIQUE,
      processo TEXT NOT NULL,
      tribunal TEXT,
      orgao TEXT,
      tipo TEXT,
      classe TEXT,
      texto TEXT NOT NULL,
      data_disponibilizacao TEXT NOT NULL,
      link TEXT,
      partes TEXT,
      lida INTEGER NOT NULL DEFAULT 0,
      origem TEXT NOT NULL DEFAULT 'djen',
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS prazos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      intimacao_id INTEGER REFERENCES intimacoes(id) ON DELETE SET NULL,
      processo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      cliente TEXT,
      dias INTEGER NOT NULL,
      contagem TEXT NOT NULL,
      data_disponibilizacao TEXT NOT NULL,
      data_publicacao TEXT NOT NULL,
      data_inicio TEXT NOT NULL,
      data_fim TEXT NOT NULL,
      dias_pulados TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pendente',
      notif_ids TEXT NOT NULL DEFAULT '[]',
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS feriados_locais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL,
      descricao TEXT NOT NULL,
      anual INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Colunas adicionadas depois da primeira versão (bancos já existentes não as têm).
  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(intimacoes)');
  const tem = new Set(cols.map((c) => c.name));
  for (const [nome, tipo] of [
    ['tipo_documento', 'TEXT'], // "Decisão", "Despacho", "Sentença"...
    ['destinatarios', 'TEXT'], // JSON [{ nome, polo }]
    ['advogados', 'TEXT'], // JSON [{ nome, oab, uf }]
  ] as const) {
    if (!tem.has(nome)) await db.execAsync(`ALTER TABLE intimacoes ADD COLUMN ${nome} ${tipo}`);
  }
}
