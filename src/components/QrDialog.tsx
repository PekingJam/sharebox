import { QRCodeSVG } from 'qrcode.react'
import { Dialog } from './Dialog'
import { CopyButton } from './CopyButton'
import { shareLink } from '../lib/format'
import { buttonClass } from './Button'

interface QrDialogProps {
  open: boolean
  onClose: () => void
  code: string
}

export function QrDialog({ open, onClose, code }: QrDialogProps) {
  const link = shareLink(code)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="扫码提取"
      description="使用手机扫码，提取码会自动填入"
      size="sm"
      footer={
        <button type="button" className={buttonClass('secondary')} onClick={onClose}>
          关闭
        </button>
      }
    >
      <div className="flex flex-col items-center gap-5 py-2">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <QRCodeSVG value={link} size={200} bgColor="#ffffff" fgColor="#111827" level="M" />
        </div>
        <div className="text-center">
          <p className="font-mono text-2xl font-semibold tracking-[0.3em] text-ink">{code}</p>
          <p className="mt-2 max-w-full break-all px-2 text-xs text-ink-faint">{link}</p>
        </div>
        <CopyButton text={link} label="复制链接" variant="secondary" />
      </div>
    </Dialog>
  )
}
