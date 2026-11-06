import { existsSync } from 'node:fs'
import path from 'node:path'

// 本地开发时自动读取 .env；容器内通常没有该文件，环境变量优先。
try {
  if (existsSync('.env')) process.loadEnvFile('.env')
} catch {
  // 忽略 .env 读取失败
}

function readInt(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) ? value : fallback
}

function readBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key]
  if (raw == null || raw.trim() === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

const dataDir = path.resolve(process.env.DATA_DIR?.trim() || './data')
const maxUploadMb = clamp(readInt('MAX_UPLOAD_MB', 200), 1, 4096)
const cookieSecureRaw = (process.env.COOKIE_SECURE?.trim().toLowerCase() || 'auto') as string

export const config = {
  isProd: process.env.NODE_ENV === 'production',
  host: process.env.HOST?.trim() || '0.0.0.0',
  port: clamp(readInt('PORT', 3000), 1, 65535),
  dataDir,
  uploadDir: path.join(dataDir, 'uploads'),
  tmpDir: path.join(dataDir, 'tmp'),
  dbFile: path.join(dataDir, 'sharebox.db'),
  staticDir: path.resolve(process.env.STATIC_DIR?.trim() || './dist'),
  siteName: (process.env.SITE_NAME?.trim() || '轻传').slice(0, 32),
  adminPassword: process.env.ADMIN_PASSWORD ?? '',
  resetAdminPassword: readBool('RESET_ADMIN_PASSWORD', false),
  maxUploadMb,
  maxTotalMb: clamp(readInt('MAX_TOTAL_MB', maxUploadMb * 2), maxUploadMb, 8192),
  trustProxy: readBool('TRUST_PROXY', false),
  cookieSecure: (cookieSecureRaw === 'true' || cookieSecureRaw === 'false' ? cookieSecureRaw : 'auto') as
    | 'auto'
    | 'true'
    | 'false',
  sessionDays: clamp(readInt('SESSION_DAYS', 7), 1, 90),
  tokenMinutes: clamp(readInt('DOWNLOAD_TOKEN_MINUTES', 60), 1, 720),
  logLevel: process.env.LOG_LEVEL?.trim() || 'info',
}

export const MAX_TEXT_CHARS = 200_000
export const MAX_FILES = 10
export const VERSION = '1.0.0'
export const MB = 1024 * 1024
