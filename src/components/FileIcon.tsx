import {
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  FileVideo,
} from 'lucide-react'
import { cn } from '../lib/format'

function pickIcon(name: string, mime: string) {
  const extension = name.split('.').pop()?.toLowerCase() ?? ''
  if (mime.startsWith('image/')) {
    return { Icon: FileImage, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' }
  }
  if (mime.startsWith('video/')) {
    return { Icon: FileVideo, color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' }
  }
  if (mime.startsWith('audio/')) {
    return { Icon: FileAudio, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' }
  }
  if (mime === 'application/pdf' || extension === 'pdf') {
    return { Icon: FileType2, color: 'bg-red-500/10 text-red-600 dark:text-red-400' }
  }
  if (mime === 'application/zip' || ['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
    return { Icon: FileArchive, color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' }
  }
  if (['xls', 'xlsx', 'csv'].includes(extension)) {
    return { Icon: FileSpreadsheet, color: 'bg-green-500/10 text-green-600 dark:text-green-400' }
  }
  if (['js', 'ts', 'tsx', 'jsx', 'json', 'go', 'py', 'java', 'rs', 'c', 'cpp', 'sh', 'html', 'css'].includes(extension)) {
    return { Icon: FileCode2, color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' }
  }
  if (['md', 'txt', 'log', 'doc', 'docx'].includes(extension)) {
    return { Icon: FileText, color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' }
  }
  return { Icon: File, color: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400' }
}

export function FileIcon({
  name,
  mime,
  className,
}: {
  name: string
  mime: string
  className?: string
}) {
  const { Icon, color } = pickIcon(name, mime)
  return (
    <span
      className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', color, className)}
      aria-hidden
    >
      <Icon className="h-[18px] w-[18px]" />
    </span>
  )
}
