import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import archiver from 'archiver'
import type { FastifyInstance } from 'fastify'
import { config, MAX_FILES, MAX_TEXT_CHARS, VERSION } from '../config.js'
import {
  createTextShare,
  getFileById,
  getFilesForShare,
  getShareById,
  fileAbsolutePath,
  unlockShare,
} from '../shares.js'
import { verifyShareToken } from '../tokens.js'
import {
  HttpError,
  contentDisposition,
  defaultTextTitle,
  isInlineAllowed,
  parseRange,
  resolveExpiry,
  resolveMaxDownloads,
  sanitizeFilename,
  sanitizeTitle,
  uniqueZipName,
} from '../util.js'

function authorizeShareToken(token: unknown, shareId: string): void {
  const payload = verifyShareToken(token)
  if (!payload) {
    throw new HttpError(401, 'invalid_token', '下载凭证已失效，请重新输入提取码')
  }
  if (payload.shareId !== shareId) {
    throw new HttpError(403, 'forbidden', '下载凭证与文件不匹配')
  }
}

function assertShareAvailable(shareId: string): void {
  const share = getShareById(shareId)
  if (!share) throw new HttpError(404, 'not_found', '分享不存在或已被删除')
  if (share.expires_at != null && share.expires_at <= Date.now()) {
    throw new HttpError(410, 'expired', '分享已过期，文件已被清理')
  }
}

export default async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async () => ({ ok: true, version: VERSION }))

  app.get('/api/config', async () => ({
    siteName: config.siteName,
    version: VERSION,
    maxUploadMb: config.maxUploadMb,
    maxTotalMb: config.maxTotalMb,
    maxFiles: MAX_FILES,
    tokenMinutes: config.tokenMinutes,
  }))

  app.post(
    '/api/unlock',
    {
      config: {
        rateLimit: { max: 20, timeWindow: '1 minute' },
      },
    },
    async (request) => {
      const body = (request.body ?? {}) as { code?: unknown }
      const code = typeof body.code === 'string' ? body.code : ''
      return unlockShare(code)
    },
  )

  // 访客无需登录即可创建文本分享；文件上传仍由管理员接口提供
  app.post(
    '/api/shares/text',
    {
      config: {
        rateLimit: { max: 6, timeWindow: '10 minutes' },
      },
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

  app.get('/api/files/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const query = request.query as { token?: string; download?: string }
    const payload = verifyShareToken(query.token)
    if (!payload) {
      throw new HttpError(401, 'invalid_token', '下载凭证已失效，请重新输入提取码')
    }

    const file = getFileById(id)
    if (!file || file.share_id !== payload.shareId) {
      throw new HttpError(404, 'not_found', '文件不存在或已被删除')
    }
    assertShareAvailable(file.share_id)

    const absolutePath = fileAbsolutePath(file.share_id, file.id)
    const stat = await fsp.stat(absolutePath).catch(() => null)
    if (!stat || !stat.isFile()) {
      throw new HttpError(410, 'gone', '文件已被清理')
    }

    const inline = query.download !== '1' && isInlineAllowed(file.mime)
    const range = parseRange(request.headers.range, stat.size)
    if (range === 'invalid') {
      return reply
        .code(416)
        .header('Content-Range', `bytes */${stat.size}`)
        .send({ error: 'range_not_satisfiable', message: '请求的文件范围无效' })
    }

    reply
      .header('Content-Type', inline ? withCharset(file.mime) : 'application/octet-stream')
      .header('Content-Disposition', contentDisposition(file.name, inline))
      .header('Cache-Control', 'private, no-store')
      .header('Accept-Ranges', 'bytes')
      .header('X-Content-Type-Options', 'nosniff')
      // 允许同源页面内联预览（PDF iframe）；其余来源仍被拒绝
      .header('Content-Security-Policy', "frame-ancestors 'self'")

    if (stat.size === 0) {
      return reply.header('Content-Length', '0').send()
    }

    if (range) {
      const chunkSize = range.end - range.start + 1
      return reply
        .code(206)
        .header('Content-Range', `bytes ${range.start}-${range.end}/${stat.size}`)
        .header('Content-Length', String(chunkSize))
        .send(createReadStream(absolutePath, { start: range.start, end: range.end }))
    }

    return reply
      .header('Content-Length', String(stat.size))
      .send(createReadStream(absolutePath))
  })

  app.get('/api/shares/:id/zip', async (request, reply) => {
    const { id } = request.params as { id: string }
    const query = request.query as { token?: string }
    authorizeShareToken(query.token, id)
    assertShareAvailable(id)

    const share = getShareById(id)
    if (!share) throw new HttpError(404, 'not_found', '分享不存在')
    const files = getFilesForShare(id)
    if (files.length === 0) throw new HttpError(404, 'no_files', '该分享没有可下载的文件')

    const archive = archiver('zip', { zlib: { level: 6 } })
    archive.on('warning', (error) => {
      if (error.code !== 'ENOENT') request.log.warn({ err: error }, '打包文件时出现警告')
    })
    archive.on('error', (error) => {
      request.log.error({ err: error }, '打包文件失败')
      reply.raw.destroy(error)
    })

    const usedNames = new Set<string>()
    const zipName = sanitizeFilename(`${share.title || '分享文件'}.zip`)

    reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', contentDisposition(zipName, false))
      .header('Cache-Control', 'private, no-store')

    reply.send(archive)

    for (const file of files) {
      const absolutePath = fileAbsolutePath(id, file.id)
      if (fs.existsSync(absolutePath)) {
        archive.file(absolutePath, { name: uniqueZipName(file.name, usedNames) })
      }
    }

    await archive.finalize()
  })
}

function withCharset(mime: string): string {
  return mime.startsWith('text/') || mime === 'application/json' ? `${mime}; charset=utf-8` : mime
}
