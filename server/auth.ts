import type { FastifyReply, FastifyRequest } from 'fastify'
import { config } from './config.js'
import { randomToken, sha256 } from './crypto.js'
import { db } from './store.js'

declare module 'fastify' {
  interface FastifyRequest {
    adminSession?: { tokenHash: string; expiresAt: number }
  }
}

export const SESSION_COOKIE = 'sb_session'

const sessionStatements = {
  insert: db.prepare('INSERT INTO sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)'),
  find: db.prepare('SELECT token_hash, expires_at FROM sessions WHERE token_hash = ?'),
  remove: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  removeExpired: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
  removeAll: db.prepare('DELETE FROM sessions'),
  removeOthers: db.prepare('DELETE FROM sessions WHERE token_hash <> ?'),
}

function useSecureCookie(req: FastifyRequest): boolean {
  if (config.cookieSecure === 'true') return true
  if (config.cookieSecure === 'false') return false
  return req.protocol === 'https'
}

export function createSession(): { token: string; expiresAt: number } {
  const token = randomToken(32)
  const now = Date.now()
  const expiresAt = now + config.sessionDays * 24 * 60 * 60 * 1000
  sessionStatements.insert.run(sha256(token), now, expiresAt)
  sessionStatements.removeExpired.run(now)
  return { token, expiresAt }
}

export function readSession(req: FastifyRequest): { tokenHash: string; expiresAt: number } | null {
  const raw = req.cookies?.[SESSION_COOKIE]
  if (!raw) return null
  const tokenHash = sha256(raw)
  const row = sessionStatements.find.get(tokenHash) as
    | { token_hash: string; expires_at: number }
    | undefined
  if (!row) return null
  if (row.expires_at <= Date.now()) {
    sessionStatements.remove.run(tokenHash)
    return null
  }
  return { tokenHash, expiresAt: row.expires_at }
}

export function setSessionCookie(req: FastifyRequest, reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: useSecureCookie(req),
    maxAge: config.sessionDays * 24 * 60 * 60,
  })
}

export function clearSessionCookie(req: FastifyRequest, reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: useSecureCookie(req),
  })
}

export function deleteSession(tokenHash: string): void {
  sessionStatements.remove.run(tokenHash)
}

export function deleteAllSessions(): void {
  sessionStatements.removeAll.run()
}

export function deleteOtherSessions(tokenHash: string): void {
  sessionStatements.removeOthers.run(tokenHash)
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const session = readSession(req)
  if (!session) {
    await reply.code(401).send({ error: 'unauthorized', message: '登录状态已失效，请重新登录' })
    return
  }
  req.adminSession = session
}
