import { createContext, useContext } from 'react'
import type { SiteConfig } from '../types'

export const DEFAULT_CONFIG: SiteConfig = {
  siteName: '轻传',
  version: '1.0.0',
  maxUploadMb: 200,
  maxTotalMb: 500,
  maxFiles: 10,
  tokenMinutes: 60,
}

export const SiteConfigContext = createContext<SiteConfig>(DEFAULT_CONFIG)

export function useSiteConfig(): SiteConfig {
  return useContext(SiteConfigContext)
}
