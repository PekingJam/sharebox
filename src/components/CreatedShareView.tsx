import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, QrCode } from 'lucide-react'
import { Button, buttonClass } from './Button'
import { CopyButton } from './CopyButton'
import { QrDialog } from './QrDialog'
import { formatDateTime, shareLink } from '../lib/format'
import type { CreatedShare } from '../types'

interface CreatedShareViewProps {
  created: CreatedShare
  onReset: () => void
  backHref: string
  backLabel: string
  resetLabel: string
}

export function CreatedShareView({
  created,
  onReset,
  backHref,
  backLabel,
  resetLabel,
}: CreatedShareViewProps) {
  const [qrOpen, setQrOpen] = useState(false)
  const link = shareLink(created.code)

  return (
    <div className="mx-auto max-w-xl animate-fade-up">
      <div className="card p-6 text-center sm:p-8">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">分享创建成功</h1>
        <p className="mt-1.5 text-sm leading-6 text-ink-soft">
          把提取码或链接发给对方，无需登录即可提取。
        </p>

        <div className="mt-6 rounded-xl border border-dashed border-line bg-surface-muted/50 px-4 py-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-faint">提取码</p>
          <p
            data-testid="share-code"
            className="mt-2 font-mono text-3xl font-semibold tracking-[0.24em] text-ink sm:text-4xl"
          >
            {created.code}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <CopyButton text={created.code} label="复制提取码" variant="secondary" />
          <CopyButton
            text={`${link}\n提取码：${created.code}`}
            label="复制分享信息"
            variant="secondary"
          />
        </div>
        <Button
          variant="secondary"
          className="mt-2 w-full"
          onClick={() => setQrOpen(true)}
          icon={<QrCode className="h-4 w-4" aria-hidden />}
        >
          查看二维码
        </Button>

        <div className="mt-5 rounded-xl bg-surface-muted/60 px-3.5 py-3 text-left text-[11px] leading-5 text-ink-faint">
          <p>
            类型：{created.kind === 'text' ? '文本' : '文件'}
            {created.fileCount ? `（${created.fileCount} 个）` : ''} · 有效期：
            {created.expiresAt ? formatDateTime(created.expiresAt) : '永久有效'}
          </p>
          <p className="mt-1 break-all">链接：{link}</p>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" className="flex-1" onClick={onReset}>
            {resetLabel}
          </Button>
          <Link to={backHref} className={buttonClass('primary', 'md', 'flex-1')}>
            {backLabel}
          </Link>
        </div>
      </div>

      <QrDialog open={qrOpen} onClose={() => setQrOpen(false)} code={created.code} />
    </div>
  )
}
