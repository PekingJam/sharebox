import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import type { FastifyInstance } from 'fastify'
import { config, MAX_FILES, MAX_TEXT_CHARS, MB } from '../config.js'
import {
  createFileShare,
  createTextShare,
  deleteShare,
  getAdminShare,
  getStats,
  listShares,
  type PendingFile,
} from '../shares.js'
import {
  clearSessionCookie,
  createSession,
  deleteAllSessions,
  deleteOtherSessions,
  deleteSession,
  readSession,
  requireAdmin,
  setSessionCookie,
} from '../auth.js'
import { hashPassword, verifyPassword } from '../crypto.js'
import { getAdminPasswordHash, setSetting } from '../store.js'
import {
  HttpError,
  defaultTextTitle,
  normalizeMime,
  resolveExpiry,
  resolveMaxDownloads,
  sanitizeFilename,
  sanitizeTitle,
} from '../util.js'

async function removeTempFiles(files: PendingFile[]): Promise<void> {
  await Promise.all(
    files.map((file) => fs.rm(file.tmpPath, { recursive: true, force: true }).catch(() => undefined)),
  )
}

export default async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/admin/login',
    {
      config: { rateLimit: { max: 8, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const body = (request.body ?? {}) as { password?: unknown }
      const password = typeof body.password === 'string' ? body.password : ''
      const storedHash = getAdminPasswordHash()
      if (!storedHash) {
        throw new HttpError(500, 'not_initialized', '管理员密码尚未初始化，请检查服务端配置')
      }
      if (!password || !verifyPassword(password, storedHash)) {
        throw new HttpError(401, 'invalid_password', '密码不正确')
      }
      const session = createSession()
      setSessionCookie(request, reply, session.token)
      return reply.send({ ok: true, expiresAt: session.expiresAt })
    },
  )

  app.post('/api/admin/logout', async (request, reply) => {
    const session = readSession(request)
    if (session) deleteSession(session.tokenHash)
    clearSessionCookie(request, reply)
    return reply.send({ ok: true })
  })

  await app.register(async (scope) => {
    scope.addHook('preHandler', requireAdmin)

    scope.get('/api/admin/me', async (_request, reply) => {
      return reply.send({ authenticated: true, siteName: config.siteName })
    })

    scope.get('/api/admin/stats', async (_request, reply) => {
      return reply.send(getStats())
    })

    scope.get('/api/admin/shares', async (request, reply) => {
      const query = request.query as { q?: string; page?: string; pageSize?: string }
      const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1)
      const pageSize = Math.min(50, Math.max(5, Number.parseInt(query.pageSize ?? '20', 10) || 20))
      return reply.send(listShares(query.q ?? '', page, pageSize))
    })

    scope.post(
      '/api/admin/shares',
      {
        config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      },
      async (request, reply) => {
        const body = (request.body ?? {}) as Record<string, unknown>
        const rawContent = typeof body.content === 'string' ? body.content : ''
        const content = rawContent.replace(/\r\n/g, '\n')
        if (!content.trim()) {
          throw new HttpError(400, 'empty_content', '文本内容不能为空')
        }
        if (content.length > MAX_TEXT_CHARS) {
          throw new HttpError(400, 'content_too_long', `文本内容不能超过 ${MAX_TEXT_CHARS} 个字符`)
        }

        const burnAfterRead = body.burnAfterRead === true
        const { expiresAt } = resolveExpiry(body.expiresIn)
        const maxDownloads = burnAfterRead ? 1 : resolveMaxDownloads(body.maxDownloads)
        const created = createTextShare({
          title: sanitizeTitle(body.title, defaultTextTitle(content)),
          content,
          expiresAt,
          maxDownloads,
          burnAfterRead,
        })

        return reply.code(201).send({ ...created, kind: 'text' as const })
      },
    )

    scope.post(
      '/api/admin/shares/files',
      {
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      },
      async (request, reply) => {
        if (!request.isMultipart()) {
          throw new HttpError(400, 'invalid_content_type', '请使用 multipart/form-data 上传文件')
        }

        const fields: Record<string, string> = {}
        const files: PendingFile[] = []
        let totalSize = 0
        let pendingTmpPath: string | null = null

        try {
          const parts = request.parts({
            limits: {
              fileSize: config.maxUploadMb * MB,
              files: MAX_FILES,
              fields: 20,
              parts: MAX_FILES + 25,
            },
          })

          for await (const part of parts) {
            if (part.type === 'file') {
              if (!part.filename) {
                part.file.resume()
                continue
              }

              const id = randomUUID()
              const tmpPath = path.join(config.tmpDir, id)
              pendingTmpPath = tmpPath
              await pipeline(part.file, createWriteStream(tmpPath))
              pendingTmpPath = null

              const stat = await fs.stat(tmpPath)
              totalSize += stat.size
              if (totalSize > config.maxTotalMb * MB) {
                await fs.rm(tmpPath, { force: true })
                throw new HttpError(
                  413,
                  'total_too_large',
                  `文件总大小超过限制（最大 ${config.maxTotalMb} MB）`,
                )
              }

              files.push({
                id,
                name: sanitizeFilename(part.filename),
                size: stat.size,
                mime: normalizeMime(part.mimetype),
                tmpPath,
              })
            } else if (typeof part.value === 'string') {
              fields[part.fieldname] = part.value
            }
          }
        } catch (error) {
          if (pendingTmpPath) await fs.rm(pendingTmpPath, { force: true }).catch(() => undefined)
          await removeTempFiles(files)
          throw error
        }

        if (files.length === 0) {
          throw new HttpError(400, 'no_files', '请至少选择一个文件')
        }

        const burnAfterRead = fields.burnAfterRead === 'true'
        const { expiresAt } = resolveExpiry(fields.expiresIn)
        const maxDownloads = burnAfterRead ? 1 : resolveMaxDownloads(fields.maxDownloads)
        const fallbackTitle =
          files.length === 1 ? files[0].name : `${files[0].name} 等 ${files.length} 个文件`
        const title = sanitizeTitle(fields.title, fallbackTitle)

        try {
          const created = await createFileShare(
            { title, expiresAt, maxDownloads, burnAfterRead },
            files,
          )
          return reply.code(201).send({
            ...created,
            kind: 'files' as const,
            fileCount: files.length,
            totalSize,
          })
        } catch (error) {
          await removeTempFiles(files)
          throw error
        }
      },
    )

    scope.delete('/api/admin/shares/:id', async (request, reply) => {
      const { id } = request.params as { id: string }
      if (!getAdminShare(id)) {
        throw new HttpError(404, 'not_found', '分享不存在或已被删除')
      }
      await deleteShare(id)
      return reply.send({ ok: true })
    })

    scope.post('/api/admin/password', async (request, reply) => {
      const body = (request.body ?? {}) as { currentPassword?: unknown; newPassword?: unknown }
      const current = typeof body.currentPassword === 'string' ? body.currentPassword : ''
      const next = typeof body.newPassword === 'string' ? body.newPassword : ''
      if (next.length < 8 || next.length > 128) {
        throw new HttpError(400, 'invalid_password', '新密码长度需为 8 - 128 位')
      }
      const storedHash = getAdminPasswordHash()
      if (!storedHash || !verifyPassword(current, storedHash)) {
        throw new HttpError(400, 'invalid_current_password', '当前密码不正确')
      }
      setSetting('admin_password_hash', hashPassword(next))
      const tokenHash = request.adminSession?.tokenHash
      if (tokenHash) deleteOtherSessions(tokenHash)
      return reply.send({ ok: true })
    })

    scope.post('/api/admin/logout-all', async (request, reply) => {
      deleteAllSessions()
      clearSessionCookie(request, reply)
      return reply.send({ ok: true })
    })
  })
}
