import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { useSiteConfig } from '../lib/site-config'
import { cn } from '../lib/format'

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  const config = useSiteConfig()
  return (
    <Link
      to="/"
      aria-label={`${config.siteName} 首页`}
      className={cn('group inline-flex items-center gap-2.5', className)}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-gradient-to-br from-indigo-500 via-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/25 transition-transform duration-200 group-hover:-translate-y-0.5">
        <ArrowUpRight className="h-[18px] w-[18px]" strokeWidth={2.6} aria-hidden />
      </span>
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span className="text-[17px] font-semibold tracking-tight text-ink">{config.siteName}</span>
          <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-ink-faint">
            ShareBox
          </span>
        </span>
      ) : null}
    </Link>
  )
}
