import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from './config.js'
import { deleteShare, listExpiredShareIds } from './shares.js'
import { db } from './store.js'

let running = false

/** 删除过期分享、过期会话以及残留的临时上传文件 */
export async function cleanupExpired(now = Date.now()): Promise<number> {
  if (running) return 0
  running = true
  try {
    let removed = 0
    for (const id of listExpiredShareIds(now)) {
      await deleteShare(id)
      removed += 1
    }

    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now)

    const entries = await fs.readdir(config.tmpDir).catch(() => [] as string[])
    for (const entry of entries) {
      const filePath = path.join(config.tmpDir, entry)
      const stat = await fs.stat(filePath).catch(() => null)
      if (stat && now - stat.mtimeMs > 6 * 60 * 60 * 1000) {
        await fs.rm(filePath, { recursive: true, force: true }).catch(() => undefined)
      }
    }

    return removed
  } finally {
    running = false
  }
}
