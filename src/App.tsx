import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Write from './pages/Write'
import AdminLogin from './pages/AdminLogin'
import AdminLayout from './pages/AdminLayout'
import Dashboard from './pages/Dashboard'
import NewShare from './pages/NewShare'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'
import { DEFAULT_CONFIG, SiteConfigContext } from './lib/site-config'
import { api } from './lib/api'
import type { SiteConfig } from './types'

export default function App() {
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_CONFIG)

  useEffect(() => {
    let active = true
    api.config()
      .then((result) => {
        if (active) setConfig(result)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    document.title = `${config.siteName} · 提取码中转站`
  }, [config.siteName])

  return (
    <SiteConfigContext.Provider value={config}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/write" element={<Write />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="new" element={<NewShare />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </SiteConfigContext.Provider>
  )
}
