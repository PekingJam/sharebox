export type ShareKind = 'text' | 'files'
export type ShareStatus = 'active' | 'expired' | 'burned' | 'exhausted'

export interface SiteConfig {
  siteName: string
  version: string
  maxUploadMb: number
  maxTotalMb: number
  maxFiles: number
  tokenMinutes: number
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

export interface AdminShare {
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

export interface Stats {
  totalShares: number
  textShares: number
  fileShares: number
  activeShares: number
  totalFiles: number
  totalBytes: number
  totalDownloads: number
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface CreatedShare {
  id: string
  code: string
  createdAt: number
  expiresAt: number | null
  kind: ShareKind
  fileCount?: number
  totalSize?: number
}

export type ExpiryOption = '1h' | '1d' | '7d' | '30d' | 'never'
