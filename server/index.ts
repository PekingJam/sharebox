import path from 'node:path'
import { existsSync } from 'node:fs'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import { config, MAX_FILES, MB } from './config.js'
import { closeDb, ensureAdmin } from './store.js'
import { cleanupExpired } from './cleanup.js'
import { HttpError } from './util.js'
import publicRoutes from './routes/public.js'
import adminRoutes from './routes/admin.js'

async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      serializers: {
        // 日志中不记录查询串，避免下载令牌、提取码进入日志
        req(request) {
          return {
            method: request.method,
            url: request.url.split('?')[0],
            host: request.headers.host,
            remoteAddress: request.ip,
          }
        },
      },
    },
    trustProxy: config.trustProxy,
    bodyLimit: 2 * MB,
  })

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        mediaSrc: ["'self'", 'blob:'],
        frameSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
    crossOriginEmbedderPolicy: false,
  })

  await app.register(cookie)

  await app.register(rateLimit, {
    global: false,
    max: 60,
    timeWindow: '1 minute',
  })

  await app.register(multipart, {
    limits: {
      fileSize: config.maxUploadMb * MB,
      files: MAX_FILES,
      fields: 20,
      parts: MAX_FILES + 25,
    },
  })

  // 简单的同源校验，配合 SameSite Cookie 抵御 CSRF
  app.addHook('onRequest', async (request, reply) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return
    const origin = request.headers.origin
    if (!origin) return
    try {
      const originUrl = new URL(origin)
      if (originUrl.host !== request.headers.host) {
        return reply.code(403).send({ error: 'bad_origin', message: '请求来源无效' })
      }
    } catch {
      return reply.code(403).send({ error: 'bad_origin', message: '请求来源无效' })
    }
  })

  // API 响应（含提取码、令牌）禁止浏览器缓存
  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url.startsWith('/api/')) {
      reply.header('Cache-Control', 'no-store')
    }
    return payload
  })

  await app.register(publicRoutes)
  await app.register(adminRoutes)

  if (existsSync(path.join(config.staticDir, 'index.html'))) {
    await app.register(fastifyStatic, {
      root: config.staticDir,
      prefix: '/',
      index: ['index.html'],
      wildcard: false,
      cacheControl: false,
      setHeaders(res, filePath) {
        const normalized = filePath.split(path.sep).join('/')
        if (normalized.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        } else {
          res.setHeader('Cache-Control', 'no-cache')
        }
      },
    })
  }

  app.setNotFoundHandler((request, reply) => {
    const isGet = request.method === 'GET'
    const isApi = request.url.startsWith('/api/')
    const isAsset = request.url.startsWith('/assets/')
    const indexFile = path.join(config.staticDir, 'index.html')
    if (isGet && !isApi && !isAsset && existsSync(indexFile)) {
      return reply.type('text/html').sendFile('index.html')
    }
    return reply.code(404).send({ error: 'not_found', message: '页面不存在' })
  })

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: error.code, message: error.message })
    }

    const fastifyError = error as { statusCode?: number; code?: string; message?: string }
    const statusCode = typeof fastifyError.statusCode === 'number' ? fastifyError.statusCode : 500
    const code = typeof fastifyError.code === 'string' ? fastifyError.code : ''

    if (statusCode === 429) {
      return reply
        .code(429)
        .send({ error: 'rate_limited', message: '操作过于频繁，请稍候再试' })
    }

    if (
      statusCode === 413 ||
      code === 'FST_REQ_FILE_TOO_LARGE' ||
      code === 'FST_FILES_LIMIT' ||
      code === 'FST_PARTS_LIMIT'
    ) {
      return reply.code(413).send({
        error: 'too_large',
        message: `文件超出限制（单文件最大 ${config.maxUploadMb} MB，最多 ${MAX_FILES} 个文件）`,
      })
    }

    if (statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send({
        error: 'bad_request',
        message: code === 'FST_ERR_CTP_INVALID_JSON_BODY' ? '请求内容不是合法的 JSON' : '请求无效，请检查输入',
      })
    }

    request.log.error({ err: error }, '未处理的服务端错误')
    return reply.code(500).send({ error: 'internal_error', message: '服务器开小差了，请稍后再试' })
  })

  return app
}

async function main(): Promise<void> {
  const init = ensureAdmin()
  const app = await buildApp()

  await app.listen({ host: config.host, port: config.port })

  if (init.initialized) {
    app.log.info('管理员密码已根据 ADMIN_PASSWORD 完成初始化')
  }
  if (init.reset) {
    app.log.warn('管理员密码已根据 RESET_ADMIN_PASSWORD 重置，请移除该环境变量并妥善保管新密码')
  }
  app.log.info(
    `轻传 ShareBox 已启动：http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`,
  )

  const runCleanup = () => {
    cleanupExpired()
      .then((removed) => {
        if (removed > 0) app.log.info(`已清理 ${removed} 个过期分享`)
      })
      .catch((error) => app.log.error({ err: error }, '清理过期分享失败'))
  }

  const initialTimer = setTimeout(runCleanup, 10_000)
  initialTimer.unref()
  const cleanupTimer = setInterval(runCleanup, 5 * 60 * 1000)
  cleanupTimer.unref()

  let closing = false
  const shutdown = async (signal: string): Promise<void> => {
    if (closing) return
    closing = true
    app.log.info({ signal }, '正在关闭服务')
    clearTimeout(initialTimer)
    clearInterval(cleanupTimer)
    try {
      await app.close()
      closeDb()
      process.exit(0)
    } catch (error) {
      app.log.error({ err: error }, '关闭服务时出错')
      process.exit(1)
    }
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[sharebox] 启动失败：${message}`)
  process.exit(1)
})
