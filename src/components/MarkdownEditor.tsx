import { useRef, useState } from 'react'
import {
  Bold,
  Code2,
  FileText,
  Heading2,
  Italic,
  Link2,
  List,
  SquareCode,
} from 'lucide-react'
import { cn } from '../lib/format'
import { MarkdownView } from './MarkdownView'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = '在这里写下要分享的内容…\n\n支持 Markdown：标题、列表、表格、代码块等。',
  disabled = false,
  className,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')

  const insert = (before: string, after = '', placeholderText = '文本') => {
    const element = textareaRef.current
    const start = element?.selectionStart ?? value.length
    const end = element?.selectionEnd ?? value.length
    const selected = value.slice(start, end) || placeholderText
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`
    onChange(next)
    requestAnimationFrame(() => {
      const node = textareaRef.current
      if (!node) return
      node.focus()
      node.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }

  const prefixLine = (prefix: string) => {
    const element = textareaRef.current
    const start = element?.selectionStart ?? 0
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    const next = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`
    onChange(next)
    requestAnimationFrame(() => {
      const node = textareaRef.current
      if (!node) return
      node.focus()
      node.setSelectionRange(start + prefix.length, start + prefix.length)
    })
  }

  const tools = [
    { label: '加粗', icon: Bold, action: () => insert('**', '**') },
    { label: '斜体', icon: Italic, action: () => insert('*', '*') },
    { label: '标题', icon: Heading2, action: () => prefixLine('## ') },
    { label: '行内代码', icon: Code2, action: () => insert('`', '`', 'code') },
    {
      label: '代码块',
      icon: SquareCode,
      action: () => insert('\n```\n', '\n```\n', 'console.log(1)'),
    },
    { label: '无序列表', icon: List, action: () => prefixLine('- ') },
    { label: '链接', icon: Link2, action: () => insert('[', '](https://)', '链接文字') },
  ]

  return (
    <div className={cn('card overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
          <FileText className="h-4 w-4 text-indigo-500" aria-hidden />
          Markdown 内容
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-line p-0.5 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileTab('edit')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium',
                mobileTab === 'edit' ? 'bg-surface-muted text-ink' : 'text-ink-faint',
              )}
            >
              编辑
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('preview')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium',
                mobileTab === 'preview' ? 'bg-surface-muted text-ink' : 'text-ink-faint',
              )}
            >
              预览
            </button>
          </div>
          <span className="hidden text-[11px] text-ink-faint sm:inline">
            {value.length.toLocaleString()} 字符
          </span>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:divide-x lg:divide-line">
        <div
          className={cn(
            'flex min-h-[420px] flex-col',
            mobileTab === 'preview' && 'hidden lg:flex',
          )}
        >
          <div className="flex items-center gap-0.5 overflow-x-auto border-b border-line px-2 py-1.5">
            {tools.map((tool) => (
              <button
                key={tool.label}
                type="button"
                title={tool.label}
                aria-label={tool.label}
                disabled={disabled}
                onClick={tool.action}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-50"
              >
                <tool.icon className="h-4 w-4" aria-hidden />
              </button>
            ))}
          </div>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            disabled={disabled}
            className="min-h-[360px] w-full flex-1 resize-y border-0 bg-transparent px-4 py-3.5 font-mono text-[13px] leading-6 text-ink outline-none placeholder:text-ink-faint/70 focus:ring-0 disabled:opacity-60"
          />
          <div className="flex items-center justify-between border-t border-line px-3.5 py-2 text-[11px] text-ink-faint">
            <span>支持 Markdown 语法</span>
            <span>{value.length.toLocaleString()} / 200,000</span>
          </div>
        </div>

        <div
          className={cn(
            'min-h-[420px] overflow-y-auto bg-surface-muted/30 p-5 lg:max-h-[560px]',
            mobileTab === 'edit' && 'hidden lg:block',
          )}
        >
          {value.trim() ? (
            <MarkdownView
              markdown={value}
              className="prose-h1:text-[26px] prose-h1:leading-tight prose-h2:text-xl prose-h3:text-lg prose-p:text-sm prose-p:leading-6 prose-li:text-sm prose-li:leading-6"
            />
          ) : (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
              <FileText className="h-6 w-6 text-ink-faint/50" aria-hidden />
              <p className="mt-3 text-sm font-medium text-ink-soft">预览区域</p>
              <p className="mt-1 text-xs text-ink-faint">输入内容后可在这里实时查看排版效果</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
