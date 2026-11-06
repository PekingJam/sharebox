import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '../lib/format'

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-muted text-ink-faint">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden />}
      </div>
      <p className="mt-4 text-sm font-medium text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-xs text-xs leading-5 text-ink-faint">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
