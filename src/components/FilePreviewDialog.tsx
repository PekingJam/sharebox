import { useEffect, useState, type ReactNode } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Dialog } from './Dialog'
import { buttonClass } from './Button'
import { downloadUrl, formatBytes } from '../lib/format'
import type { PublicFile } from '../types'

function isTextPreview(mime: string): boolean {
  return (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml' ||
    mime === 'application/javascript'
  )
}

interface FilePreviewDialogProps {
  file: PublicFile | null
  token: string | null
  open: boolean
  onClose: () => void
}

export function FilePreviewDialog({ file, token, open, onClose }: FilePreviewDialogProps) {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setText(null)
    setError('')
    if (!open || !file || !token || !isTextPreview(file.mime)) return

    const controller = new AbortController()
    setLoading(true)
    fetch(downloadUrl(file.id, token), {
      signal: controller.signal,
      credentials: 'same-origin',
      headers: file.size > 0 ? { Range: 'bytes=0-204799' } : undefined,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('preview failed')
        const content = await response.text()
        setText(content.slice(0, 200_000))
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError('预览加载失败，请下载后查看')
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [open, file, token])

  if (!file) return null

  const url = token ? downloadUrl(file.id, token) : ''

  let body: ReactNode = null
  if (loading) {
    body = (
      <div className="flex h-48 items-center justify-center text-ink-faint">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      </div>
    )
  } else if (error) {
    body = <p className="py-10 text-center text-sm text-ink-faint">{error}</p>
  } else if (file.mime.startsWith('image/')) {
    body = (
      <img
        src={url}
        alt={file.name}
        className="mx-auto max-h-[60vh] w-auto max-w-full rounded-xl object-contain"
      />
    )
  } else if (file.mime === 'application/pdf') {
    body = (
      <iframe
        src={url}
        title={file.name}
        className="h-[60vh] w-full rounded-xl border border-line bg-white"
      />
    )
  } else if (file.mime.startsWith('video/')) {
    body = (
      <video
        src={url}
        controls
        playsInline
        className="mx-auto max-h-[60vh] w-full rounded-xl bg-black"
      >
        您的浏览器不支持视频播放，请下载后查看。
      </video>
    )
  } else if (file.mime.startsWith('audio/')) {
    body = (
      <div className="py-8">
        <audio src={url} controls className="w-full">
          您的浏览器不支持音频播放，请下载后查看。
        </audio>
      </div>
    )
  } else if (text !== null) {
    body = (
      <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-surface-muted p-4 font-mono text-xs leading-6 text-ink">
        {text || '（空文件）'}
      </pre>
    )
  } else {
    body = <p className="py-10 text-center text-sm text-ink-faint">该文件类型暂不支持在线预览，请下载后查看。</p>
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={file.name}
      description={`${formatBytes(file.size)} · ${file.mime}`}
      size="xl"
      footer={
        <>
          <button type="button" className={buttonClass('secondary')} onClick={onClose}>
            关闭
          </button>
          <a
            href={token ? downloadUrl(file.id, token, true) : '#'}
            className={buttonClass('primary')}
            download
          >
            <Download className="h-4 w-4" aria-hidden />
            下载文件
          </a>
        </>
      }
    >
      {body}
    </Dialog>
  )
}
