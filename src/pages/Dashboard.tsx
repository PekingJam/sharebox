import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Download,
  Files,
  Layers,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { Button, buttonClass } from '../components/Button'
import { CopyButton } from '../components/CopyButton'
import { Dialog } from '../components/Dialog'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { ApiError, api } from '../lib/api'
import {
  cn,
  formatBytes,
  formatExpiry,
  formatShortDate,
  shareLink,
} from '../lib/format'
import type { AdminShare, Paged, ShareStatus, Stats } from '../types'

const statusMeta: Record<ShareStatus, { label: string; className: string }> = {
  active: {
    label: '有效',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  expired: {
    label: '已过期',
    className:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  },
  burned: {
    label: '已焚毁',
    className:
      'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300',
  },
  exhausted: {
    label: '已用完',
    className:
      'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-600/40 dark:bg-zinc-500/10 dark:text-zinc-300',
  },
}

function StatusBadge({ status }: { status: ShareStatus }) {
  const meta = statusMeta[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        meta.className,
      )}
    >
      {meta.label}
    </span>
  )
}

function StatsCards({ stats }: { stats: Stats | null }) {
  const items = [
    {
      label: '分享总数',
      value: stats?.totalShares ?? '—',
      hint: stats ? `文本 ${stats.textShares} · 文件 ${stats.fileShares}` : ' ',
      icon: Layers,
    },
    {
      label: '累计提取',
      value: stats?.totalDownloads ?? '—',
      hint: '所有分享被提取的次数',
      icon: Download,
    },
    {
      label: '文件数量',
      value: stats?.totalFiles ?? '—',
      hint: stats ? `占用 ${formatBytes(stats.totalBytes)}` : ' ',
      icon: Files,
    },
    {
      label: '有效分享',
      value: stats?.activeShares ?? '—',
      hint: '未过期且仍可提取',
      icon: ShieldCheck,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-ink-faint">{item.label}</p>
            <item.icon className="h-4 w-4 text-ink-faint" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{item.value}</p>
          <p className="mt-1 truncate text-[11px] text-ink-faint">{item.hint}</p>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const toast = useToast()
  const [stats, setStats] = useState<Stats | null>(null)
  const [data, setData] = useState<Paged<AdminShare> | null>(null)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<AdminShare | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const handleError = useCallback(
    (reason: unknown) => {
      if (reason instanceof ApiError && reason.status === 401) {
        navigate('/admin/login', { replace: true })
        return
      }
      toast(reason instanceof ApiError ? reason.message : '加载失败，请稍后再试', 'error')
    },
    [navigate, toast],
  )

  const loadShares = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.admin.shares({ q: query, page, pageSize: 20 })
      setData(result)
    } catch (reason) {
      handleError(reason)
    } finally {
      setLoading(false)
    }
  }, [handleError, page, query])

  const loadStats = useCallback(async () => {
    try {
      setStats(await api.admin.stats())
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        navigate('/admin/login', { replace: true })
      }
    }
  }, [navigate])

  useEffect(() => {
    void loadShares()
  }, [loadShares])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await api.admin.removeShare(deleting.id)
      toast('分享已删除，提取码立即失效', 'success')
      setDeleting(null)
      if (data && data.items.length === 1 && page > 1) {
        setPage((value) => value - 1)
      } else {
        void loadShares()
      }
      void loadStats()
    } catch (reason) {
      handleError(reason)
    } finally {
      setDeleteLoading(false)
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const items = data?.items ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-ink-faint">管理后台</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">概览</h1>
        </div>
        <Link to="/admin/new" className={buttonClass('primary')}>
          <Plus className="h-4 w-4" aria-hidden />
          新建分享
        </Link>
      </div>

      <StatsCards stats={stats} />

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-ink">全部分享</h2>
            <p className="mt-0.5 text-xs text-ink-faint">共 {data?.total ?? 0} 条记录</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
              aria-hidden
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索标题或提取码"
              aria-label="搜索分享"
              className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-ink-faint/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>
        </div>

        {loading && !data ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 px-5 py-4">
                <div className="h-9 w-9 animate-pulse rounded-xl bg-surface-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/3 animate-pulse rounded bg-surface-muted" />
                  <div className="h-3 w-1/5 animate-pulse rounded bg-surface-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title={query ? '没有匹配的分享' : '还没有创建任何分享'}
            description={
              query
                ? '试试其他标题或提取码关键词。'
                : '创建一个文本或文件分享，把提取码发给需要的人。'
            }
            action={
              query ? (
                <Button variant="secondary" onClick={() => setSearch('')}>
                  清空搜索
                </Button>
              ) : (
                <Link to="/admin/new" className={buttonClass('primary', 'sm')}>
                  <Plus className="h-4 w-4" aria-hidden />
                  新建分享
                </Link>
              )
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                    <th className="px-5 py-2.5 font-medium">内容</th>
                    <th className="px-4 py-2.5 font-medium">提取码</th>
                    <th className="hidden px-4 py-2.5 font-medium lg:table-cell">提取</th>
                    <th className="px-4 py-2.5 font-medium">有效期</th>
                    <th className="px-4 py-2.5 font-medium">状态</th>
                    <th className="px-5 py-2.5 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-surface-muted/50">
                      <td className="max-w-[280px] px-5 py-3">
                        <p className="truncate font-medium text-ink">{item.title}</p>
                        <p className="mt-0.5 text-[11px] text-ink-faint">
                          {item.kind === 'text' ? '文本' : `${item.fileCount} 个文件`} ·{' '}
                          {formatBytes(item.totalSize)} · {formatShortDate(item.createdAt)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <code className="font-mono text-[13px] font-medium tracking-[0.12em] text-ink">
                            {item.code}
                          </code>
                          <CopyButton
                            text={item.code}
                            label="复制提取码"
                            iconOnly
                            variant="ghost"
                            size="xs"
                          />
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-ink-soft lg:table-cell">
                        {item.downloadCount}
                        <span className="text-ink-faint">
                          {item.maxDownloads != null ? ` / ${item.maxDownloads}` : ''}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-soft">
                        {item.status === 'burned' ? '已焚毁' : formatExpiry(item.expiresAt)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <CopyButton
                            text={shareLink(item.code)}
                            label="复制分享链接"
                            iconOnly
                            variant="ghost"
                            size="xs"
                          />
                          <button
                            type="button"
                            onClick={() => setDeleting(item)}
                            title="删除分享"
                            aria-label={`删除分享 ${item.title}`}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-line md:hidden">
              {items.map((item) => (
                <li key={item.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                      <p className="mt-1 text-[11px] text-ink-faint">
                        {item.kind === 'text' ? '文本' : `${item.fileCount} 个文件`} ·{' '}
                        {formatBytes(item.totalSize)} · {formatShortDate(item.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <code className="rounded-md bg-surface-muted px-2 py-1 font-mono text-xs font-medium tracking-[0.15em] text-ink">
                      {item.code}
                    </code>
                    <div className="flex items-center gap-1">
                      <CopyButton
                        text={shareLink(item.code)}
                        label="复制链接"
                        variant="secondary"
                        size="sm"
                      />
                      <button
                        type="button"
                        onClick={() => setDeleting(item)}
                        title="删除分享"
                        aria-label={`删除分享 ${item.title}`}
                        className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink-faint transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-ink-faint">
                    <span>
                      提取 {item.downloadCount}
                      {item.maxDownloads != null ? ` / ${item.maxDownloads}` : ''}
                    </span>
                    <span>{item.status === 'burned' ? '已焚毁' : formatExpiry(item.expiresAt)}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between border-t border-line px-4 py-3 sm:px-5">
              <p className="text-xs text-ink-faint">
                第 {page} / {totalPages} 页
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  上一页
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                >
                  下一页
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog
        open={deleting !== null}
        onClose={() => {
          if (!deleteLoading) setDeleting(null)
        }}
        title="删除这个分享？"
        description={deleting ? `提取码 ${deleting.code} 将立即失效` : undefined}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleting(null)}
              disabled={deleteLoading}
            >
              取消
            </Button>
            <Button variant="danger" loading={deleteLoading} onClick={() => void confirmDelete()}>
              删除
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-ink-soft">
          分享的文本与文件会被立即删除，无法恢复。已经拿到提取码的人也将无法再提取。
        </p>
      </Dialog>
    </div>
  )
}
