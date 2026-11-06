import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Info, KeyRound, LogOut, ShieldCheck } from 'lucide-react'
import { Button } from '../components/Button'
import { Dialog } from '../components/Dialog'
import { Field, Input } from '../components/Fields'
import { useToast } from '../components/Toast'
import { ApiError, api } from '../lib/api'
import { useSiteConfig } from '../lib/site-config'

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  placeholder: string
}) {
  const [show, setShow] = useState(false)
  return (
    <Field label={label} htmlFor={id}>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => setShow((current) => !current)}
          aria-label={show ? '隐藏密码' : '显示密码'}
          className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    </Field>
  )
}

export default function Settings() {
  const config = useSiteConfig()
  const toast = useToast()
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const handleChangePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (!currentPassword) {
      toast('请输入当前密码', 'error')
      return
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      toast('新密码长度需为 8 - 128 位', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      toast('两次输入的新密码不一致', 'error')
      return
    }
    setSaving(true)
    try {
      await api.admin.changePassword(currentPassword, newPassword)
      toast('密码已更新，其他设备上的登录已失效', 'success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (reason) {
      toast(reason instanceof ApiError ? reason.message : '修改失败，请稍后再试', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoutAll = async () => {
    setLoggingOut(true)
    try {
      await api.admin.logoutAll()
      navigate('/admin/login', { replace: true })
    } catch (reason) {
      toast(reason instanceof ApiError ? reason.message : '操作失败，请稍后再试', 'error')
      setLoggingOut(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-medium text-ink-faint">管理后台</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">设置</h1>
        <p className="mt-1 text-sm text-ink-soft">管理管理员密码与登录状态。</p>
      </div>

      <section className="card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <KeyRound className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold text-ink">修改管理员密码</h2>
            <p className="mt-1 text-xs leading-5 text-ink-faint">
              修改后其他设备上的登录会话会自动失效，当前设备保持登录。
            </p>
          </div>
        </div>

        <form onSubmit={(event) => void handleChangePassword(event)} className="mt-5 max-w-sm space-y-4">
          <PasswordField
            id="current-password"
            label="当前密码"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            placeholder="请输入当前密码"
          />
          <PasswordField
            id="new-password"
            label="新密码"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            placeholder="至少 8 位"
          />
          <PasswordField
            id="confirm-password"
            label="确认新密码"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            placeholder="再次输入新密码"
          />
          <Button type="submit" loading={saving} disabled={saving}>
            {saving ? '保存中…' : '保存新密码'}
          </Button>
        </form>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink">登录状态</h2>
              <p className="mt-1 max-w-md text-xs leading-5 text-ink-faint">
                退出所有设备会清除全部管理员会话，包括当前浏览器。
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => setConfirmLogoutAll(true)}>
            <LogOut className="h-4 w-4" aria-hidden />
            退出所有设备
          </Button>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-muted text-ink-faint">
            <Info className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-ink">关于本站</h2>
            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
              <div className="rounded-lg bg-surface-muted/60 px-3 py-2">
                <dt className="text-ink-faint">站点名称</dt>
                <dd className="mt-0.5 font-medium text-ink">{config.siteName}</dd>
              </div>
              <div className="rounded-lg bg-surface-muted/60 px-3 py-2">
                <dt className="text-ink-faint">版本</dt>
                <dd className="mt-0.5 font-medium text-ink">v{config.version}</dd>
              </div>
              <div className="rounded-lg bg-surface-muted/60 px-3 py-2">
                <dt className="text-ink-faint">单文件上限</dt>
                <dd className="mt-0.5 font-medium text-ink">{config.maxUploadMb} MB</dd>
              </div>
              <div className="rounded-lg bg-surface-muted/60 px-3 py-2">
                <dt className="text-ink-faint">单次分享总量</dt>
                <dd className="mt-0.5 font-medium text-ink">{config.maxTotalMb} MB</dd>
              </div>
            </dl>
            <p className="mt-4 text-[11px] leading-5 text-ink-faint">
              数据保存在容器的 /data 目录中，请通过 Docker 卷持久化并定期备份。
            </p>
          </div>
        </div>
      </section>

      <Dialog
        open={confirmLogoutAll}
        onClose={() => {
          if (!loggingOut) setConfirmLogoutAll(false)
        }}
        title="退出所有设备？"
        description="所有管理员会话都会立即失效"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmLogoutAll(false)}
              disabled={loggingOut}
            >
              取消
            </Button>
            <Button variant="danger" loading={loggingOut} onClick={() => void handleLogoutAll()}>
              全部退出
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-ink-soft">
          当前浏览器也会退出登录，需要重新输入管理员密码。
        </p>
      </Dialog>
    </div>
  )
}
