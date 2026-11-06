export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** index
  const digits = index === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits).replace(/\.0+$/, '')} ${units[index]}`
}

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const shortDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function formatDateTime(timestamp: number): string {
  return dateFormatter.format(new Date(timestamp))
}

export function formatShortDate(timestamp: number): string {
  return shortDateFormatter.format(new Date(timestamp))
}

/** 将过期时间转成易读文案 */
export function formatExpiry(expiresAt: number | null): string {
  if (expiresAt == null) return '永久有效'
  const remaining = expiresAt - Date.now()
  if (remaining <= 0) return '已过期'
  if (remaining < 60 * 60 * 1000) return `${Math.max(1, Math.ceil(remaining / 60000))} 分钟后过期`
  if (remaining < 24 * 60 * 60 * 1000) return `${Math.ceil(remaining / 3600000)} 小时后过期`
  if (remaining < 30 * 24 * 60 * 60 * 1000) return `${Math.ceil(remaining / 86400000)} 天后过期`
  return `${formatShortDate(expiresAt)} 过期`
}

/** 根据剩余次数生成展示文案 */
export function formatRemaining(remaining: number | null): string | null {
  if (remaining == null) return null
  if (remaining <= 0) return '次数已用完'
  return `剩余 ${remaining} 次`
}

/** 上传有效期选项的标签 */
export const EXPIRY_OPTIONS = [
  { value: '1h', label: '1 小时' },
  { value: '1d', label: '1 天' },
  { value: '7d', label: '7 天' },
  { value: '30d', label: '30 天' },
  { value: 'never', label: '永久有效' },
] as const

export function downloadUrl(fileId: string, token: string, forceDownload = false): string {
  const params = new URLSearchParams({ token })
  if (forceDownload) params.set('download', '1')
  return `/api/files/${encodeURIComponent(fileId)}?${params.toString()}`
}

export function zipUrl(shareId: string, token: string): string {
  return `/api/shares/${encodeURIComponent(shareId)}/zip?token=${encodeURIComponent(token)}`
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      return ok
    } catch {
      return false
    }
  }
}

export function shareLink(code: string): string {
  return `${window.location.origin}/#c=${code}`
}
