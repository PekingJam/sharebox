import { useState, type ChangeEvent, type DragEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  FileText,
  Settings2,
  UploadCloud,
  X,
} from 'lucide-react'
import { Button } from '../components/Button'
import { CreatedShareView } from '../components/CreatedShareView'
import { Field, Input, Select, Switch } from '../components/Fields'
import { FileIcon } from '../components/FileIcon'
import { MarkdownEditor } from '../components/MarkdownEditor'
import { useToast } from '../components/Toast'
import { ApiError, api, uploadFiles } from '../lib/api'
import { useSiteConfig } from '../lib/site-config'
import { EXPIRY_OPTIONS, cn, formatBytes } from '../lib/format'
import type { CreatedShare, ExpiryOption } from '../types'

const MAX_TEXT_CHARS = 200_000
const MB = 1024 * 1024

type Mode = 'text' | 'files'

export default function NewShare() {
  const config = useSiteConfig()
  const toast = useToast()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('text')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [expiresIn, setExpiresIn] = useState<ExpiryOption>('7d')
  const [maxDownloads, setMaxDownloads] = useState('')
  const [burn, setBurn] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [created, setCreated] = useState<CreatedShare | null>(null)

  const totalSize = files.reduce((sum, file) => sum + file.size, 0)

  const reset = () => {
    setCreated(null)
    setTitle('')
    setContent('')
    setFiles([])
    setMaxDownloads('')
    setBurn(false)
    setExpiresIn('7d')
    setProgress(0)
  }

  const addFiles = (incoming: FileList | File[]) => {
    const next = [...files]
    for (const file of Array.from(incoming)) {
      if (next.length >= config.maxFiles) {
        toast(`最多上传 ${config.maxFiles} 个文件`, 'error')
        break
      }
      if (file.size > config.maxUploadMb * MB) {
        toast(`${file.name} 超过单文件 ${config.maxUploadMb} MB 限制`, 'error')
        continue
      }
      const duplicated = next.some(
        (item) =>
          item.name === file.name &&
          item.size === file.size &&
          item.lastModified === file.lastModified,
      )
      if (!duplicated) next.push(file)
    }
    const total = next.reduce((sum, file) => sum + file.size, 0)
    if (total > config.maxTotalMb * MB) {
      toast(`文件总大小不能超过 ${config.maxTotalMb} MB`, 'error')
      return
    }
    setFiles(next)
  }

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files)
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files)
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

    if (mode === 'text') {
      if (!content.trim()) {
        toast('请输入要分享的文本内容', 'error')
        return
      }
      if (content.length > MAX_TEXT_CHARS) {
        toast(`文本不能超过 ${MAX_TEXT_CHARS.toLocaleString()} 个字符`, 'error')
        return
      }
    } else if (files.length === 0) {
      toast('请至少选择一个文件', 'error')
      return
    }

    setSubmitting(true)
    setProgress(0)
    try {
      let result: CreatedShare
      if (mode === 'text') {
        result = await api.admin.createText({
          title: title.trim(),
          content,
          expiresIn,
          maxDownloads: downloads,
          burnAfterRead: burn,
        })
      } else {
        const formData = new FormData()
        formData.append('title', title.trim())
        formData.append('expiresIn', expiresIn)
        formData.append('maxDownloads', burn ? '1' : maxDownloads.trim())
        formData.append('burnAfterRead', burn ? 'true' : 'false')
        for (const file of files) {
          formData.append('files', file, file.name)
        }
        result = await uploadFiles(formData, setProgress)
      }
      setCreated(result)
      setProgress(1)
      toast('分享创建成功', 'success')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        navigate('/admin/login', { replace: true })
        return
      }
      toast(reason instanceof ApiError ? reason.message : '创建失败，请稍后再试', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <CreatedShareView
        created={created}
        onReset={reset}
        backHref="/admin"
        backLabel="返回概览"
        resetLabel="再建一个"
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1 text-xs font-medium text-ink-faint transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            返回概览
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">新建分享</h1>
          <p className="mt-1 text-sm text-ink-soft">创建文本或文件分享，生成 6 位提取码。</p>
        </div>

        <div
          className="inline-flex rounded-xl border border-line bg-surface p-1"
          role="tablist"
          aria-label="分享类型"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'text'}
            onClick={() => setMode('text')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              mode === 'text'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                : 'text-ink-soft hover:text-ink',
            )}
          >
            <FileText className="h-4 w-4" aria-hidden />
            文本
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'files'}
            onClick={() => setMode('files')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              mode === 'files'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                : 'text-ink-soft hover:text-ink',
            )}
          >
            <UploadCloud className="h-4 w-4" aria-hidden />
            文件
          </button>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void handleCreate()
        }}
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]"
      >
        <div className="min-w-0">
          {mode === 'text' ? (
            <MarkdownEditor value={content} onChange={setContent} disabled={submitting} />
          ) : (
            <div className="card p-4 sm:p-6">
              <label
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={(event) => {
                  event.preventDefault()
                  setDragging(false)
                }}
                onDrop={handleDrop}
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors sm:py-14',
                  dragging
                    ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-500/10'
                    : 'border-line bg-surface-muted/40 hover:border-indigo-300 hover:bg-surface-muted',
                )}
              >
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={handleFileInput}
                  aria-label="选择文件"
                />
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface text-indigo-600 shadow-sm dark:text-indigo-400">
                  <UploadCloud className="h-5 w-5" aria-hidden />
                </span>
                <p className="mt-3 text-sm font-medium text-ink">
                  拖拽文件到这里，或{' '}
                  <span className="text-indigo-600 dark:text-indigo-400">点击选择</span>
                </p>
                <p className="mt-1.5 text-xs text-ink-faint">
                  单个最大 {config.maxUploadMb} MB · 最多 {config.maxFiles} 个 · 总量{' '}
                  {config.maxTotalMb} MB
                </p>
              </label>

              {files.length > 0 ? (
                <>
                  <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line">
                    {files.map((file) => (
                      <li
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        className="flex items-center gap-3 px-3 py-2.5"
                      >
                        <FileIcon name={file.name} mime={file.type || 'application/octet-stream'} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{file.name}</p>
                          <p className="mt-0.5 text-[11px] text-ink-faint">
                            {formatBytes(file.size)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFiles((current) => current.filter((item) => item !== file))
                          }
                          className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                          aria-label={`移除 ${file.name}`}
                          title="移除"
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between text-xs text-ink-faint">
                    <span>
                      共 {files.length} 个文件 · {formatBytes(totalSize)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles([])}
                      className="font-medium text-ink-soft transition-colors hover:text-red-500"
                    >
                      清空
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-center text-xs text-ink-faint">
                  支持图片、文档、压缩包等任意类型；文件仅管理员可上传。
                </p>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="card space-y-4 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-indigo-500" aria-hidden />
              <h2 className="text-sm font-semibold text-ink">分享设置</h2>
            </div>

            <Field label="标题" htmlFor="share-title" optional>
              <Input
                id="share-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="留空自动命名"
                maxLength={120}
              />
            </Field>

            <Field label="有效期" htmlFor="share-expiry">
              <Select
                id="share-expiry"
                value={expiresIn}
                onChange={(event) => setExpiresIn(event.target.value as ExpiryOption)}
                options={EXPIRY_OPTIONS}
              />
            </Field>

            <Field label="提取次数" htmlFor="share-downloads" hint="留空为不限" optional>
              <Input
                id="share-downloads"
                type="number"
                inputMode="numeric"
                min={1}
                max={10000}
                value={burn ? '1' : maxDownloads}
                onChange={(event) => setMaxDownloads(event.target.value.replace(/[^\d]/g, ''))}
                placeholder="不限制"
                disabled={burn}
              />
            </Field>

            <div className="rounded-xl border border-line bg-surface-muted/40 p-3">
              <Switch
                checked={burn}
                onChange={setBurn}
                label="阅后即焚"
                description="仅可提取一次，提取后立即销毁，提取次数自动设为 1。"
              />
            </div>

            <Button type="submit" size="lg" className="w-full" loading={submitting}>
              {submitting
                ? mode === 'files'
                  ? `上传中 ${Math.round(progress * 100)}%`
                  : '创建中…'
                : mode === 'text'
                  ? '生成提取码'
                  : '上传并生成提取码'}
            </Button>

            {submitting && mode === 'files' ? (
              <div className="space-y-1.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-[width] duration-200"
                    style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }}
                  />
                </div>
                <p className="text-center text-[11px] text-ink-faint">请勿关闭页面</p>
              </div>
            ) : (
              <p className="text-center text-[11px] text-ink-faint">
                创建后生成 6 位提取码，可随时在概览中查看
              </p>
            )}
          </div>
        </aside>
      </form>
    </div>
  )
}
