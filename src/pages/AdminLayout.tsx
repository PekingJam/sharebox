import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Home,
  LayoutDashboard,
  Loader2,
  LogOut,
  PlusCircle,
  Settings,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { api } from '../lib/api'
import { cn } from '../lib/format'

const navItems = [
  { to: '/admin', label: '概览', icon: LayoutDashboard, end: true },
  { to: '/admin/new', label: '新建分享', icon: PlusCircle, end: false },
  { to: '/admin/settings', label: '设置', icon: Settings, end: false },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'checking' | 'ready'>('checking')

  useEffect(() => {
    let active = true
    api.admin
      .me()
      .then(() => {
        if (active) setStatus('ready')
      })
      .catch(() => {
        if (active) navigate('/admin/login', { replace: true })
      })
    return () => {
      active = false
    }
  }, [navigate])

  const logout = async () => {
    try {
      await api.admin.logout()
    } finally {
      navigate('/admin/login', { replace: true })
    }
  }

  if (status === 'checking') {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-faint" aria-label="加载中" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
        <Logo className="px-2" />
        <nav className="mt-8 space-y-1" aria-label="后台导航">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                    : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
                )
              }
            >
              <item.icon className="h-4 w-4" aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-3 border-t border-line pt-4">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <Home className="h-4 w-4" aria-hidden />
            返回首页
          </Link>
          <div className="flex items-center justify-between px-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-ink-faint transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              退出登录
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Logo />
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => void logout()}
                aria-label="退出登录"
                title="退出登录"
                className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="后台导航">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                      : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
                  )
                }
              >
                <item.icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
