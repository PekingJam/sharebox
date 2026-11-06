import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { config } from './config.js'
import { generateCode, normalizeCode, CODE_LENGTH } from './codes.js'
import { db } from './store.js'
import { signShareToken } from './tokens.js'
import {
  HttpError,
  isInlineAllowed,
} from './util.js'

export type ShareKind = 'text' | 'files'
export type ShareStatus = 'active' | 'expired' | 'burned' | 'exhausted'

export interface ShareRow {
  id: string
  kind: ShareKind
  title: string
  code: string
  text_content: string | null
  created_at: number
  expires_at: number | null
  max_downloads: number | null
  download_count: number
  burn_after_read: number
  burned_at: number | null
  total_size: number
}

export interface FileRow {
  id: string
  share_id: string
  name: string
  size: number
  mime: string
  sort_order: number
  created_at: number
}

const statements = {
  byCode: db.prepare('SELECT * FROM shares WHERE code = ?'),
  byId: db.prepare('SELECT * FROM shares WHERE id = ?'),
  filesByShare: db.prepare('SELECT * FROM files WHERE share_id = ? ORDER BY sort_order ASC, rowid ASC'),
  fileById: db.prepare('SELECT * FROM files WHERE id = ?'),
  existsCode: db.prepare('SELECT 1 AS ok FROM shares WHERE code = ?'),
  insertShare: db.prepare(`
    INSERT INTO shares (
      id, kind, title, code, text_content, created_at, expires_at,
      max_downloads, download_count, burn_after_read, burned_at, total_size
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, ?)
  `),
  insertFile: db.prepare(
    'INSERT INTO files (id, share_id, name, size, mime, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ),
  deleteShare: db.prepare('DELETE FROM shares WHERE id = ?'),
  increment: db.prepare('UPDATE shares SET download_count = download_count + 1 WHERE id = ?'),
  incrementBurn: db.prepare(
    'UPDATE shares SET download_count = download_count + 1, burned_at = ?, expires_at = ? WHERE id = ?',
  ),
  incrementExpiry: db.prepare(
    'UPDATE shares SET download_count = download_count + 1, expires_at = ? WHERE id = ?',
  ),
  expiredIds: db.prepare(
    'SELECT id FROM shares WHERE expires_at IS NOT NULL AND expires_at <= ? LIMIT 200',
  ),
}

function uniqueCode(): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = generateCode()
    if (!statements.existsCode.get(code)) return code
  }
  throw new Error('提取码空间已耗尽，无法创建新的分享')
}

export function findShareByCode(input: string): ShareRow | undefined {
  const code = normalizeCode(input)
  if (code.length !== CODE_LENGTH) return undefined
  return statements.byCode.get(code) as ShareRow | undefined
}

export function getShareById(id: string): ShareRow | undefined {
  return statements.byId.get(id) as ShareRow | undefined
}

export function getFilesForShare(shareId: string): FileRow[] {
  return statements.filesByShare.all(shareId) as unknown as FileRow[]
}

export function getFileById(fileId: string): FileRow | undefined {
  return statements.fileById.get(fileId) as FileRow | undefined
}

export function fileAbsolutePath(shareId: string, fileId: string): string {
  return path.join(config.uploadDir, shareId, fileId)
}

export function shareStatus(share: ShareRow, now = Date.now()): ShareStatus {
  if (share.burned_at != null) return 'burned'
  if (share.expires_at != null && share.expires_at <= now) return 'expired'
  if (share.max_downloads != null && share.download_count >= share.max_downloads) return 'exhausted'
  return 'active'
}

export async function deleteShare(shareId: string): Promise<void> {
  statements.deleteShare.run(shareId)
  await fs.rm(path.join(config.uploadDir, shareId), { recursive: true, force: true })
}

export interface CreateShareInput {
  title: string
  expiresAt: number | null
  maxDownloads: number | null
  burnAfterRead: boolean
}

export interface CreateTextInput extends CreateShareInput {
  content: string
}

export interface CreatedShare {
  id: string
  code: string
  createdAt: number
  expiresAt: number | null
}

export function createTextShare(input: CreateTextInput): CreatedShare {
  const id = randomUUID()
  const code = uniqueCode()
  const now = Date.now()
  const size = Buffer.byteLength(input.content, 'utf8')
  statements.insertShare.run(
    id,
    'text',
    input.title,
    code,
    input.content,
    now,
    input.expiresAt,
    input.maxDownloads,
    input.burnAfterRead ? 1 : 0,
    size,
  )
  return { id, code, createdAt: now, expiresAt: input.expiresAt }
}

export interface PendingFile {
  id: string
  name: string
  size: number
  mime: string
  tmpPath: string
}

export async function createFileShare(
  input: CreateShareInput,
  files: PendingFile[],
): Promise<CreatedShare> {
  if (files.length === 0) throw new HttpError(400, 'no_files', '请至少上传一个文件')

  const id = randomUUID()
  const code = uniqueCode()
  const now = Date.now()
  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  const shareDir = path.join(config.uploadDir, id)

  await fs.mkdir(shareDir, { recursive: true })
  try {
    for (const file of files) {
      await fs.rename(file.tmpPath, path.join(shareDir, file.id))
    }

    db.exec('BEGIN IMMEDIATE')
    try {
      statements.insertShare.run(
        id,
        'files',
        input.title,
        code,
        null,
        now,
        input.expiresAt,
        input.maxDownloads,
        input.burnAfterRead ? 1 : 0,
        totalSize,
      )
      files.forEach((file, index) => {
        statements.insertFile.run(file.id, id, file.name, file.size, file.mime, index, now)
      })
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  } catch (error) {
    await fs.rm(shareDir, { recursive: true, force: true })
    throw error
  }

  return { id, code, createdAt: now, expiresAt: input.expiresAt }
}

export interface PublicFile {
  id: string
  name: string
  size: number
  mime: string
  previewable: boolean
}

export interface UnlockResult {
  share: {
    id: string
    kind: ShareKind
    title: string
    createdAt: number
    expiresAt: number | null
    maxDownloads: number | null
    remainingDownloads: number | null
    burnAfterRead: boolean
  }
  text: string | null
  files: PublicFile[]
  token: string | null
  tokenExpiresAt: number | null
}

const BURN_RETENTION_MS = Math.max(60 * 60 * 1000, (config.tokenMinutes + 5) * 60 * 1000)

export async function unlockShare(rawCode: string): Promise<UnlockResult> {
  const code = normalizeCode(rawCode)
  if (code.length !== CODE_LENGTH) {
    throw new HttpError(400, 'invalid_code', '请输入 6 位提取码')
  }

  const share = findShareByCode(code)
  if (!share) {
    throw new HttpError(404, 'not_found', '提取码不存在，请检查后重试')
  }

  const status = shareStatus(share)
  if (status === 'burned') {
    throw new HttpError(410, 'burned', '该分享已阅后即焚，无法再次提取')
  }
  if (status === 'expired') {
    await deleteShare(share.id)
    throw new HttpError(410, 'expired', '该分享已过期并被清理')
  }
  if (status === 'exhausted') {
    throw new HttpError(410, 'exhausted', '该分享的提取次数已用完')
  }

  const now = Date.now()
  const nextCount = share.download_count + 1
  const maxDownloads = share.max_downloads
  const reachedLimit = maxDownloads != null && nextCount >= maxDownloads
  const remainingDownloads = maxDownloads == null ? null : Math.max(0, maxDownloads - nextCount)
  const files = share.kind === 'files' ? getFilesForShare(share.id) : []
  let effectiveExpiry = share.expires_at

  if (share.kind === 'text') {
    const content = share.text_content ?? ''
    if (share.burn_after_read === 1) {
      await deleteShare(share.id)
      effectiveExpiry = now
    } else {
      statements.increment.run(share.id)
    }

    return {
      share: {
        id: share.id,
        kind: 'text',
        title: share.title,
        createdAt: share.created_at,
        expiresAt: effectiveExpiry,
        maxDownloads,
        remainingDownloads,
        burnAfterRead: share.burn_after_read === 1,
      },
      text: content,
      files: [],
      token: null,
      tokenExpiresAt: null,
    }
  }

  if (share.burn_after_read === 1) {
    effectiveExpiry = Math.min(share.expires_at ?? Number.POSITIVE_INFINITY, now + BURN_RETENTION_MS)
    statements.incrementBurn.run(now, effectiveExpiry, share.id)
  } else if (reachedLimit) {
    // 次数用完后保留一小时，供本次已签发的下载令牌继续使用，之后自动清理
    effectiveExpiry = Math.min(share.expires_at ?? Number.POSITIVE_INFINITY, now + BURN_RETENTION_MS)
    statements.incrementExpiry.run(effectiveExpiry, share.id)
  } else {
    statements.increment.run(share.id)
  }

  const signed = signShareToken(share.id)

  return {
    share: {
      id: share.id,
      kind: 'files',
      title: share.title,
      createdAt: share.created_at,
      expiresAt: effectiveExpiry,
      maxDownloads,
      remainingDownloads,
      burnAfterRead: share.burn_after_read === 1,
    },
    text: null,
    files: files.map((file) => ({
      id: file.id,
      name: file.name,
      size: file.size,
      mime: file.mime,
      previewable: isInlineAllowed(file.mime),
    })),
    token: signed.token,
    tokenExpiresAt: signed.expiresAt,
  }
}

export interface AdminShareItem {
  id: string
  kind: ShareKind
  title: string
  code: string
  createdAt: number
  expiresAt: number | null
  maxDownloads: number | null
  downloadCount: number
  remainingDownloads: number | null
  burnAfterRead: boolean
  fileCount: number
  totalSize: number
  status: ShareStatus
}

function toAdminItem(row: ShareRow, fileCount: number): AdminShareItem {
  const status = shareStatus(row)
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    code: row.code,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    maxDownloads: row.max_downloads,
    downloadCount: row.download_count,
    remainingDownloads:
      row.max_downloads == null ? null : Math.max(0, row.max_downloads - row.download_count),
    burnAfterRead: row.burn_after_read === 1,
    fileCount,
    totalSize: row.total_size,
    status,
  }
}

export function listShares(
  query: string,
  page: number,
  pageSize: number,
): { items: AdminShareItem[]; total: number; page: number; pageSize: number } {
  const q = query.trim().toLowerCase()
  const offset = (page - 1) * pageSize
  const rows = db
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM files f WHERE f.share_id = s.id) AS file_count
       FROM shares s
       WHERE (? = '' OR instr(lower(s.title), ?) > 0 OR instr(lower(s.code), ?) > 0)
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(q, q, q, pageSize, offset) as unknown as Array<ShareRow & { file_count: number }>
  const totalRow = db
    .prepare(
      `SELECT COUNT(*) AS total FROM shares
       WHERE (? = '' OR instr(lower(title), ?) > 0 OR instr(lower(code), ?) > 0)`,
    )
    .get(q, q, q) as { total: number } | undefined

  return {
    items: rows.map((row) => toAdminItem(row, row.file_count)),
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  }
}

export function getAdminShare(id: string): AdminShareItem | null {
  const row = getShareById(id)
  if (!row) return null
  const count = db.prepare('SELECT COUNT(*) AS n FROM files WHERE share_id = ?').get(id) as
    | { n: number }
    | undefined
  return toAdminItem(row, count?.n ?? 0)
}

export interface Stats {
  totalShares: number
  textShares: number
  fileShares: number
  activeShares: number
  totalFiles: number
  totalBytes: number
  totalDownloads: number
}

export function getStats(): Stats {
  const shares = db
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN kind = 'text' THEN 1 ELSE 0 END), 0) AS text_count,
              COALESCE(SUM(CASE WHEN kind = 'files' THEN 1 ELSE 0 END), 0) AS file_count,
              COALESCE(SUM(download_count), 0) AS downloads
       FROM shares`,
    )
    .get() as { total: number; text_count: number; file_count: number; downloads: number }
  const files = db
    .prepare('SELECT COUNT(*) AS total, COALESCE(SUM(size), 0) AS bytes FROM files')
    .get() as { total: number; bytes: number }
  const active = db
    .prepare(
      `SELECT COUNT(*) AS n FROM shares
       WHERE burned_at IS NULL
         AND (expires_at IS NULL OR expires_at > ?)
         AND (max_downloads IS NULL OR download_count < max_downloads)`,
    )
    .get(Date.now()) as { n: number }

  return {
    totalShares: shares.total,
    textShares: shares.text_count,
    fileShares: shares.file_count,
    activeShares: active.n,
    totalFiles: files.total,
    totalBytes: files.bytes,
    totalDownloads: shares.downloads,
  }
}

export function listExpiredShareIds(now: number): string[] {
  const rows = statements.expiredIds.all(now) as unknown as Array<{ id: string }>
  return rows.map((row) => row.id)
}
