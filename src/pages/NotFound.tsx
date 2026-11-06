import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { buttonClass } from '../components/Button'

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface text-ink-faint shadow-card">
          <Compass className="h-6 w-6" aria-hidden />
        </span>
        <p className="mt-6 font-mono text-5xl font-semibold tracking-tight text-ink-faint/50">404</p>
        <h1 className="mt-2 text-lg font-semibold text-ink">页面不存在</h1>
        <p className="mt-1.5 text-sm text-ink-soft">链接可能已经失效，或者地址输入有误。</p>
        <Link to="/" className={buttonClass('primary', 'md', 'mt-6')}>
          返回首页
        </Link>
      </div>
    </div>
  )
}
