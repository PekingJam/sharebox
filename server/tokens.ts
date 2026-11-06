import { config } from './config.js'
import { hmac, safeEqual } from './crypto.js'
import { getSecret } from './store.js'

export interface ShareTokenPayload {
  shareId: string
  expiresAt: number
}

/**
 * 下载令牌：提取成功后签发，短时间有效，仅能访问对应分享的文件。
 * 使用 HMAC 签名，服务重启后仍然有效。
 */
export function signShareToken(shareId: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + config.tokenMinutes * 60 * 1000
  const payload = Buffer.from(JSON.stringify({ s: shareId, e: expiresAt })).toString('base64url')
  const signature = hmac(payload, getSecret())
  return { token: `${payload}.${signature}`, expiresAt }
}

export function verifyShareToken(token: unknown): ShareTokenPayload | null {
  if (typeof token !== 'string' || token.length === 0 || token.length > 600) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const payload = token.slice(0, dot)
  const signature = token.slice(dot + 1)
  const expected = hmac(payload, getSecret())
  if (!safeEqual(signature, expected)) return null

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      s?: unknown
      e?: unknown
    }
    if (typeof data.s !== 'string' || typeof data.e !== 'number') return null
    if (data.e <= Date.now()) return null
    return { shareId: data.s, expiresAt: data.e }
  } catch {
    return null
  }
}
