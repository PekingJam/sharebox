import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/Button'
import { Field, Input } from '../components/Fields'
import { ApiError, api } from '../lib/api'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.admin
      .me()
      .then(() => {
        if (active) navigate('/admin', { replace: true })
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [navigate])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!password) {
      setError('请输入管理员密码')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.admin.login(password)
      navigate('/admin', { replace: true })
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : '登录失败，请稍后再试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-gradient-to-b from-indigo-500/10 to-transparent"
      />
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-20 pt-6">
        <div className="w-full max-w-sm">
          <div className="card p-6 sm:p-8">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <LockKeyhole className="h-5 w-5" aria-hidden />
            </span>
            <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">管理员登录</h1>
            <p className="mt-1.5 text-sm leading-6 text-ink-soft">
              登录后可上传文件、创建分享并管理已有内容。
            </p>

            <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-4" noValidate>
              <Field label="管理员密码" htmlFor="password" error={error || undefined}>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={visible ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      setError('')
                    }}
                    placeholder="请输入密码"
                    autoComplete="current-password"
                    autoFocus
                    className="pr-11"
                    aria-invalid={error ? true : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setVisible((value) => !value)}
                    aria-label={visible ? '隐藏密码' : '显示密码'}
                    className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
                  >
                    {visible ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
              </Field>

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {loading ? '登录中…' : '登录'}
              </Button>
            </form>
          </div>

          <p className="mt-5 text-center text-xs text-ink-faint">
            <Link to="/" className="transition-colors hover:text-ink">
              ← 返回首页
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
