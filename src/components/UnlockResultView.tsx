import { useState, type ReactNode } from 'react'
import {
  Archive,
  Download,
  Eye,
  FileText,
  Flame,
  LockKeyhole,
  Timer,
} from 'lucide-react'
import { Button, buttonClass } from './Button'
import { CopyButton } from './CopyButton'
import { FileIcon } from './FileIcon'
import { FilePreviewDialog } from './FilePreviewDialog'
import { MarkdownView } from './MarkdownView'
import {
  downloadUrl,
  formatBytes,
  formatDateTime,
  formatExpiry,
  zipUrl,
} from '../lib/format'
import type { PublicFile, UnlockResult } from '../types'

function MetaBadge({
  children,
  icon,
}: {
  children: ReactNode
  icon?: ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-soft">
      {icon}
      {children}
    </span>
  )
}

export function UnlockResultView({
  result,
  onReset,
}: {
  result: UnlockResult
  onReset: () => void
}) {
  const [preview, setPreview] = useState<PublicFile | null>(null)
  const { share, text, files, token, tokenExpiresAt } = result
  const isText = share.kind === 'text'
  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  const remaining = share.remainingDownloads
  const burnedText = share.burnAfterRead && isText

  return (
    <section className="card mt-8 animate-fade-up overflow-hidden" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            {isText ? <FileText className="h-5 w-5" aria-hidden /> : <Archive className="h-5 w-5" aria-hidden />}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
              {isText ? '文本内容' : '文件分享'}
            </p>
            <h2 className="mt-0.5 truncate text-lg font-semibold text-ink">
              {share.title || (isText ? '未命名文本' : '未命名分享')}
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {burnedText ? (
            <MetaBadge icon={<Flame className="h-3 w-3" aria-hidden />}>已焚毁</MetaBadge>
          ) : (
            <MetaBadge icon={<Timer className="h-3 w-3" aria-hidden />}>
              {share.burnAfterRead ? '阅后即焚' : formatExpiry(share.expiresAt)}
            </MetaBadge>
          )}
          {remaining != null ? <MetaBadge>{`剩余 ${remaining} 次`}</MetaBadge> : null}
          {isText && text ? (
            <CopyButton text={text} label="复制全文" size="sm" variant="secondary" />
          ) : null}
        </div>
      </div>

      {isText ? (
        <>
          <div className="px-5 py-6 sm:px-7 sm:py-7">
            <MarkdownView markdown={text ?? ''} className="mx-auto max-w-3xl" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-muted/40 px-5 py-3">
            <p className="text-xs leading-5 text-ink-faint">
              {burnedText
                ? '该内容已按“阅后即焚”设置销毁，请及时保存。'
                : '内容由分享者创建，请自行判断安全性。'}
            </p>
            <Button variant="ghost" size="sm" onClick={onReset}>
              提取其它内容
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-muted/40 px-5 py-3">
            <p className="text-xs text-ink-faint">
              {files.length} 个文件 · {formatBytes(totalSize)}
              {tokenExpiresAt ? ` · 下载链接 ${formatDateTime(tokenExpiresAt)} 前有效` : ''}
            </p>
            <a
              href={token ? zipUrl(share.id, token) : '#'}
              className={buttonClass('secondary', 'sm')}
              download
            >
              <Archive className="h-4 w-4" aria-hidden />
              打包下载
            </a>
          </div>

          <ul className="divide-y divide-line">
            {files.map((file) => (
              <li key={file.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <FileIcon name={file.name} mime={file.mime} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{file.name}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {formatBytes(file.size)}
                    {file.previewable ? ' · 支持在线预览' : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {file.previewable ? (
                    <Button variant="ghost" size="sm" onClick={() => setPreview(file)}>
                      <Eye className="h-4 w-4" aria-hidden />
                      <span className="hidden sm:inline">预览</span>
                    </Button>
                  ) : null}
                  <a
                    href={token ? downloadUrl(file.id, token, true) : '#'}
                    className={buttonClass('secondary', 'sm')}
                    download
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    下载
                  </a>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-muted/40 px-5 py-3">
            <p className="flex items-center gap-1.5 text-xs leading-5 text-ink-faint">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
              {share.burnAfterRead
                ? '阅后即焚已触发：关闭后无法再次提取，文件将在下载链接失效后清理。'
                : '下载链接为临时凭证，失效后重新输入提取码即可。'}
            </p>
            <Button variant="ghost" size="sm" onClick={onReset}>
              提取其它内容
            </Button>
          </div>
        </>
      )}

      <FilePreviewDialog
        file={preview}
        token={token}
        open={preview !== null}
        onClose={() => setPreview(null)}
      />
    </section>
  )
}
