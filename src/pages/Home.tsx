import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Eye,
  Flame,
  Loader2,
  PenLine,
  Settings2,
  ShieldCheck,
  Sparkles,
  TimerReset,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { UnlockResultView } from '../components/UnlockResultView'
import { buttonClass } from '../components/Button'
import { useSiteConfig } from '../lib/site-config'
import { ApiError, api } from '../lib/api'
import type { UnlockResult } from '../types'

const features = [
  {
    icon: ShieldCheck,
    title: '无需登录',
    description: '输入提取码即可获取内容',
  },
  {
    icon: TimerReset,
    title: '到期清理',
    description: '内容到期自动删除，不占用多余空间',
  },
  {
    icon: Flame,
    title: '阅后即焚',
    description: '敏感内容仅可提取一次，取后即销毁',
  },
  {
    icon: Eye,
    title: '在线预览',
    description: '图片、PDF、视频与文本直接查看',
  },
]

export default function Home() {
  const config = useSiteConfig()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UnlockResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const autoRan = useRef(false)

  const unlock = useCallback(async (rawCode: string) => {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await api.unlock(rawCode)
      setResult(data)
    } catch (reason) {
      if (reason instanceof ApiError) {
        setError(reason.message)
      } else {
        setError('网络异常，请稍后再试')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (autoRan.current) return
    const match = /^#c=([A-Za-z0-9]{6})$/.exec(window.location.hash)
    if (!match) return
    autoRan.current = true
    const value = match[1].toUpperCase()
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    setCode(value)
    void unlock(value)
  }, [unlock])

  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (code.length !== 6) {
      setError('请输入完整的 6 位提取码')
      inputRef.current?.focus()
      return
    }
    void unlock(code)
  }

  const reset = () => {
    setResult(null)
    setCode('')
    setError('')
    inputRef.current?.focus()
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-surface-muted/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-1.5">
            <Link to="/write" className={buttonClass('subtle', 'sm')} aria-label="写一条文本分享">
              <PenLine className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">写分享</span>
            </Link>
            <ThemeToggle />
            <Link to="/admin" className={buttonClass('secondary', 'sm')} aria-label="管理后台">
              <Settings2 className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">管理</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/70 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            免登录 · 一码直达
          </span>
          <h1 className="mt-6 text-balance text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl sm:leading-[1.15]">
            输入
            <span className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">
              提取码
            </span>
            ，取走你的内容
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-[15px] leading-7 text-ink-soft">
            文本、文件与压缩包，一个提取码即可取走。
            <br className="hidden sm:block" />
            内容到期自动清理，支持阅后即焚。
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="card mx-auto mt-9 max-w-xl p-4 sm:p-6"
          noValidate
        >
          <label htmlFor="code" className="sr-only">
            提取码
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              ref={inputRef}
              id="code"
              name="code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
                setError('')
              }}
              placeholder="ABC123"
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              disabled={loading}
              aria-invalid={error ? true : undefined}
              aria-describedby="code-hint"
              className="h-14 w-full rounded-xl border border-line bg-surface-muted/60 px-4 text-center font-mono text-2xl font-semibold uppercase tracking-[0.4em] text-ink caret-indigo-500 outline-none transition placeholder:text-ink-faint/40 hover:border-zinc-300 focus:border-indigo-400 focus:bg-surface focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60 sm:flex-1 dark:hover:border-zinc-600"
            />
            <button
              type="submit"
              className={buttonClass('primary', 'lg', 'h-14 sm:w-32')}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <ArrowRight className="h-5 w-5" aria-hidden />
              )}
              {loading ? '提取中' : '提取'}
            </button>
          </div>
          <p id="code-hint" className="mt-3 text-center text-xs text-ink-faint">
            6 位字母数字，不区分大小写 · 无需注册登录
          </p>
          {error ? (
            <div
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
              role="alert"
            >
              {error}
            </div>
          ) : null}
        </form>

        <div ref={resultRef} className="scroll-mt-24">
          {result ? <UnlockResultView result={result} onReset={reset} /> : null}
        </div>

        {!result ? (
          <>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-4 lg:grid-cols-4">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-xl border border-line/80 bg-surface/60 p-4 backdrop-blur-sm sm:p-4"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <feature.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <p className="mt-3 text-sm font-medium text-ink">{feature.title}</p>
                  <p className="mt-1 text-xs leading-5 text-ink-faint">{feature.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-center">
              <Link
                to="/write"
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-xs font-medium text-ink-soft transition-colors hover:border-indigo-200 hover:text-indigo-600 dark:hover:border-indigo-500/40 dark:hover:text-indigo-400"
              >
                <PenLine className="h-3.5 w-3.5" aria-hidden />
                免登录，写一条文本分享
              </Link>
            </div>
          </>
        ) : null}
      </main>

      <footer className="border-t border-line/70">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-3 px-4 py-7 text-xs text-ink-faint sm:flex-row sm:px-6">
          <p>
            {new Date().getFullYear()} {config.siteName} · 自托管的中转站
          </p>
          <div className="flex items-center gap-4">
            <Link to="/admin" className="transition-colors hover:text-ink">
              管理入口
            </Link>
            <span>v{config.version}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
