import { useEffect, useMemo, useRef } from 'react'
import { cn } from '../lib/format'
import { renderMarkdown } from '../lib/markdown'

export function MarkdownView({ markdown, className }: { markdown: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(markdown), [markdown])
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    container.current?.querySelectorAll('a').forEach((anchor) => {
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer nofollow'
    })
  }, [html])

  return (
    <div
      ref={container}
      className={cn('markdown-body', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
