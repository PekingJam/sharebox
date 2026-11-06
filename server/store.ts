import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { config } from './config.js'
import { hashPassword, randomToken } from './crypto.js'

fs.mkdirSync(config.uploadDir, { recursive: true })
fs.mkdirSync(config.tmpDir, { recursive: true })

export const db = new DatabaseSync(config.dbFile)

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shares (
    id              TEXT PRIMARY KEY,
    kind            TEXT NOT NULL,
    title           TEXT NOT NULL DEFAULT '',
    code            TEXT NOT NULL UNIQUE,
    text_content    TEXT,
    created_at      INTEGER NOT NULL,
    expires_at      INTEGER,
    max_downloads   INTEGER,
    download_count  INTEGER NOT NULL DEFAULT 0,
    burn_after_read INTEGER NOT NULL DEFAULT 0,
    burned_at       INTEGER,
    total_size      INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_shares_created ON shares (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_shares_expires ON shares (expires_at);

  CREATE TABLE IF NOT EXISTS files (
    id         TEXT PRIMARY KEY,
    share_id   TEXT NOT NULL REFERENCES shares (id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    size       INTEGER NOT NULL,
    mime       TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_files_share ON files (share_id);

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);
`)

const getSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?')
const setSettingStmt = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
)

export function getSetting(key: string): string | null {
  const row = getSettingStmt.get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  setSettingStmt.run(key, value)
}

// 首次启动生成服务端密钥，用于签发下载令牌。密钥随数据库持久化，重启后令牌和会话依然有效。
const existingSecret = getSetting('server_secret')
const serverSecret = existingSecret ?? randomToken(32)
if (!existingSecret) {
  setSetting('server_secret', serverSecret)
  setSetting('installed_at', String(Date.now()))
}

export function getSecret(): string {
  return serverSecret
}

export function getAdminPasswordHash(): string | null {
  return getSetting('admin_password_hash')
}

export interface AdminInitResult {
  initialized: boolean
  reset: boolean
}

/**
 * 首次启动时用 ADMIN_PASSWORD 初始化管理员密码；之后以数据库中的密码为准。
 * 忘记密码时可临时设置 RESET_ADMIN_PASSWORD=true 重启一次。
 */
export function ensureAdmin(): AdminInitResult {
  const stored = getAdminPasswordHash()
  const reset = config.resetAdminPassword && Boolean(stored)
  if (stored && !config.resetAdminPassword) {
    return { initialized: false, reset: false }
  }

  const password = config.adminPassword.trim()
  if (password.length < 8) {
    throw new Error(
      '未设置管理员密码。请通过环境变量 ADMIN_PASSWORD 提供一个至少 8 位的密码（或在 .env 中配置）。',
    )
  }

  setSetting('admin_password_hash', hashPassword(password))
  db.exec('DELETE FROM sessions')
  return { initialized: !stored, reset }
}

export function closeDb(): void {
  db.close()
}
