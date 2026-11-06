import type {
  AdminShare,
  CreatedShare,
  Paged,
  SiteConfig,
  Stats,
  UnlockResult,
} from '../types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, message: string, code = 'error') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function parseError(response: Response): Promise<ApiError> {
  let message = '请求失败，请稍后再试'
  let code = 'error'
  try {
    const data = (await response.json()) as { message?: string; error?: string }
    if (data.message) message = data.message
    if (data.error) code = data.error
  } catch {
    // 忽略非 JSON 响应
  }
  return new ApiError(response.status, message, code)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers,
  })
  if (!response.ok) throw await parseError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  config: () => request<SiteConfig>('/api/config'),

  unlock: (code: string) =>
    request<UnlockResult>('/api/unlock', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  createPublicText: (input: {
    title: string
    content: string
    expiresIn: string
    maxDownloads: number | null
    burnAfterRead: boolean
  }) =>
    request<CreatedShare>('/api/shares/text', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  admin: {
    me: () => request<{ authenticated: boolean; siteName: string }>('/api/admin/me'),

    login: (password: string) =>
      request<{ ok: boolean }>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),

    logout: () => request<{ ok: boolean }>('/api/admin/logout', { method: 'POST' }),

    logoutAll: () => request<{ ok: boolean }>('/api/admin/logout-all', { method: 'POST' }),

    stats: () => request<Stats>('/api/admin/stats'),

    shares: (params: { q?: string; page?: number; pageSize?: number }) => {
      const query = new URLSearchParams()
      if (params.q) query.set('q', params.q)
      if (params.page) query.set('page', String(params.page))
      if (params.pageSize) query.set('pageSize', String(params.pageSize))
      return request<Paged<AdminShare>>(`/api/admin/shares?${query.toString()}`)
    },

    createText: (input: {
      title: string
      content: string
      expiresIn: string
      maxDownloads: number | null
      burnAfterRead: boolean
    }) =>
      request<CreatedShare>('/api/admin/shares', {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    removeShare: (id: string) =>
      request<{ ok: boolean }>(`/api/admin/shares/${id}`, { method: 'DELETE' }),

    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ ok: boolean }>('/api/admin/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
  },
}

/** 使用 XHR 上传以便显示真实进度 */
export function uploadFiles(
  formData: FormData,
  onProgress?: (ratio: number) => void,
): Promise<CreatedShare> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/admin/shares/files')
    xhr.withCredentials = true
    xhr.responseType = 'json'

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.min(1, event.loaded / event.total))
      }
    }

    xhr.onload = () => {
      const data = xhr.response as
        | (CreatedShare & { message?: string; error?: string })
        | null
      if (xhr.status >= 200 && xhr.status < 300 && data) {
        resolve(data)
        return
      }
      const message = data?.message ?? '上传失败，请稍后再试'
      reject(new ApiError(xhr.status, message, data?.error ?? 'upload_failed'))
    }

    xhr.onerror = () => reject(new ApiError(0, '网络异常，上传失败，请检查网络后重试', 'network_error'))
    xhr.onabort = () => reject(new ApiError(0, '上传已取消', 'aborted'))
    xhr.send(formData)
  })
}
