import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, LockKeyhole, Settings2 } from 'lucide-react'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button, buttonClass } from '../components/Button'
import { CreatedShareView } from '../components/CreatedShareView'
import { Field, Input, Select, Switch } from '../components/Fields'
import { MarkdownEditor } from '../components/MarkdownEditor'
import { useToast } from '../components/Toast'
import { ApiError, api } from '../lib/api'
import { EXPIRY_OPTIONS } from '../lib/format'
import type { CreatedShare, ExpiryOption } from '../types'

const MAX_TEXT_CHARS = 200_000

export default function Write() {
  const toast = useToast()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [expiresIn, setExpiresIn] = useState<ExpiryOption>('7d')
  const [maxDownloads, setMaxDownloads] = useState('')
  const [burn, setBurn] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<CreatedShare | null>(null)

  const reset = () => {
    setCreated(null)
    setTitle('')
    setContent('')
    setMaxDownloads('')
    setBurn(false)
    setExpiresIn('7d')
  }

  const handleCreate = async () => {
    if (submitting) return

    let downloads: number | null = null
    if (burn) {
      downloads = 1
    } else if (maxDownloads.trim()) {
      const parsed = Number.parseInt(maxDownloads, 10)
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 10_000) {
        toast('提取次数需为 1 - 10000 之间的整数', 'error')
        return
      }
      downloads = parsed
    }

    if (!content.trim()) {
      toast('请输入要分享的文本内容', 'error')
      return
    }
    if (content.length > MAX_TEXT_CHARS) {
      toast(`文本不能超过 ${MAX_TEXT_CHARS.toLocaleString()} 个字符`, 'error')
      return
    }

    setSubmitting(true)
    try {
      const result = await api.createPublicText({
        title: title.trim(),
        content,
        expiresIn,
        maxDownloads: downloads,
        burnAfterRead: burn,
      })
      setCreated(result)
      toast('分享创建成功', 'success')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 429) {
        toast('创建过于频繁，请稍后再试', 'error')
        return
      }
      toast(reason instanceof ApiError ? reason.message : '创建失败，请稍后再试', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-surface-muted/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link to="/" className={buttonClass('secondary', 'sm')}>
              返回首页
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-20 pt-8 sm:px-6 sm:pt-10">
        {created ? (
          <CreatedShareView
            created={created}
            onReset={reset}
            backHref="/"
            backLabel="返回首页"
            resetLabel="再写一条"
          />
        ) : (
          <div className="space-y-6">
            <div>
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-xs font-medium text-ink-faint transition-colors hover:text-ink"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                返回首页
              </Link>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                写一条文本分享
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-ink-soft">
                无需登录，写下内容即可生成提取码。支持 Markdown 排版、有效期与阅后即焚。
              </p>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                void handleCreate()
              }}
              className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]"
            >
              <div className="min-w-0">
                <MarkdownEditor value={content} onChange={setContent} disabled={submitting} />
              </div>

              <aside className="space-y-4 lg:sticky lg:top-6">
                <div className="card space-y-4 p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-indigo-500" aria-hidden />
                    <h2 className="text-sm font-semibold text-ink">分享设置</h2>
                  </div>

                  <Field label="标题" htmlFor="write-title" optional>
                    <Input
                      id="write-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="留空自动命名"
                      maxLength={120}
                    />
                  </Field>

                  <Field label="有效期" htmlFor="write-expiry">
                    <Select
                      id="write-expiry"
                      value={expiresIn}
                      onChange={(event) => setExpiresIn(event.target.value as ExpiryOption)}
                      options={EXPIRY_OPTIONS}
                    />
                  </Field>

                  <Field label="提取次数" htmlFor="write-downloads" hint="留空为不限" optional>
                    <Input
                      id="write-downloads"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={10000}
                      value={burn ? '1' : maxDownloads}
                      onChange={(event) =>
                        setMaxDownloads(event.target.value.replace(/[^\d]/g, ''))
                      }
                      placeholder="不限制"
                      disabled={burn}
                    />
                  </Field>

                  <div className="rounded-xl border border-line bg-surface-muted/40 p-3">
                    <Switch
                      checked={burn}
                      onChange={setBurn}
                      label="阅后即焚"
                      description="仅可提取一次，提取后立即销毁。"
                    />
                  </div>

                  <Button type="submit" size="lg" className="w-full" loading={submitting}>
                    {submitting ? '创建中…' : '生成提取码'}
                  </Button>

                  <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-faint">
                    <LockKeyhole className="h-3 w-3" aria-hidden />
                    创建后生成 6 位提取码
                  </p>
                </div>

                <div className="rounded-xl border border-line bg-surface/60 p-4 text-xs leading-5 text-ink-faint">
                  需要分享文件？文件上传仅限管理员，请
                  <button
                    type="button"
                    onClick={() => navigate('/admin/login')}
                    className="mx-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    登录管理账户
                  </button>
                  后上传。
                </div>
              </aside>
            </form>
          </div>
        )}
      </main>

      <footer className="border-t border-line/70">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-center px-4 py-6 text-xs text-ink-faint">
          轻传 · 内容由分享者创建，请注意甄别
        </div>
      </footer>
    </div>
  )
}
