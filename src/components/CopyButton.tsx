import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button, type ButtonSize, type ButtonVariant } from './Button'
import { useToast } from './Toast'
import { copyToClipboard } from '../lib/format'

interface CopyButtonProps {
  text: string
  label?: string
  iconOnly?: boolean
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

export function CopyButton({
  text,
  label = '复制',
  iconOnly = false,
  variant = 'secondary',
  size = 'md',
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)
  const toast = useToast()

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  const handleCopy = async () => {
    const ok = await copyToClipboard(text)
    if (!ok) {
      toast('复制失败，请手动选择后复制', 'error')
      return
    }
    setCopied(true)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={() => void handleCopy()}
      className={className}
      title={copied ? '已复制' : label}
      aria-label={copied ? '已复制' : label}
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-500" aria-hidden />
      ) : (
        <Copy className="h-4 w-4" aria-hidden />
      )}
      {iconOnly ? (
        <span className="sr-only" aria-live="polite">
          {copied ? '已复制' : label}
        </span>
      ) : (
        <span aria-live="polite">{copied ? '已复制' : label}</span>
      )}
    </Button>
  )
}
