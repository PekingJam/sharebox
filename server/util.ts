import path from 'node:path'

export class HttpError extends Error {
  readonly statusCode: number
  readonly code: string

  constructor(statusCode: number, code: string, message: string) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
    this.code = code
  }
}

export type ExpiryOption = '1h' | '1d' | '7d' | '30d' | 'never'

const EXPIRY_MS: Record<Exclude<ExpiryOption, 'never'>, number> = {
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

export function resolveExpiry(value: unknown): { expiresAt: number | null; label: string } {
  const raw = typeof value === 'string' ? value : '7d'
  if (raw === 'never') return { expiresAt: null, label: '永久有效' }
  const option = (Object.keys(EXPIRY_MS) as Array<Exclude<ExpiryOption, 'never'>>).includes(
    raw as Exclude<ExpiryOption, 'never'>,
  )
    ? (raw as Exclude<ExpiryOption, 'never'>)
    : '7d'
  return { expiresAt: Date.now() + EXPIRY_MS[option], label: option }
}

export function resolveMaxDownloads(value: unknown): number | null {
  if (value == null || value === '' || value === '0') return null
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  if (!Number.isFinite(n) || n < 1) return null
  return Math.min(10_000, Math.floor(n))
}

export function sanitizeFilename(name: string): string {
  const base = path
    .basename(String(name || '').replace(/\\/g, '/'))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
  const cleaned = base.replace(/[<>:"/\\|?*]/g, '_').slice(0, 180)
  return cleaned || '未命名文件'
}

export function sanitizeTitle(value: unknown, fallback = ''): string {
  const raw = typeof value === 'string' ? value.replace(/[\r\n\t]+/g, ' ').trim() : ''
  return (raw || fallback).slice(0, 120)
}

export function defaultTextTitle(content: string): string {
  const firstLine = content
    .split('\n')
    .map((line) => line.replace(/^[#>\-*+\d.\s]+/, '').trim())
    .find((line) => line.length > 0)
  return (firstLine || '未命名文本').slice(0, 60)
}

const INLINE_MIME_TYPES = new Set([
  'application/pdf',
  'application/json',
  'text/plain',
  'text/markdown',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
])

export function isInlineAllowed(mime: string): boolean {
  return INLINE_MIME_TYPES.has(mime.toLowerCase())
}

export function normalizeMime(mime: string | undefined | null): string {
  const raw = (mime || '').split(';')[0].trim().toLowerCase()
  if (!raw || !/^[\w.+-]+\/[\w.+-]+$/.test(raw)) return 'application/octet-stream'
  return raw
}

/** 仅使用白名单内的类型内联展示，HTML / SVG / 脚本一律强制下载，避免 XSS。 */
export function contentDisposition(filename: string, inline: boolean): string {
  const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  const encoded = encodeURIComponent(filename).replace(/'/g, '%27')
  return `${inline ? 'inline' : 'attachment'}; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

export interface ByteRange {
  start: number
  end: number
}

export function parseRange(header: string | undefined, size: number): ByteRange | null | 'invalid' {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return 'invalid'
  const [, rawStart, rawEnd] = match
  if (!rawStart && !rawEnd) return 'invalid'
  let start: number
  let end: number
  if (!rawStart) {
    const suffix = Number.parseInt(rawEnd, 10)
    if (!Number.isFinite(suffix) || suffix <= 0) return 'invalid'
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number.parseInt(rawStart, 10)
    end = rawEnd ? Number.parseInt(rawEnd, 10) : size - 1
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return 'invalid'
  return { start, end: Math.min(end, size - 1) }
}

export function uniqueZipName(original: string, used: Set<string>): string {
  const safe = sanitizeFilename(original)
  if (!used.has(safe)) {
    used.add(safe)
    return safe
  }
  const ext = path.extname(safe)
  const stem = ext ? safe.slice(0, -ext.length) : safe
  let index = 2
  let candidate = `${stem} (${index})${ext}`
  while (used.has(candidate)) {
    index += 1
    candidate = `${stem} (${index})${ext}`
  }
  used.add(candidate)
  return candidate
}
