import { useEffect, useLayoutEffect } from 'react'
import { useTheme } from '../hooks/use-theme.js'
import { generateCssVariables } from '@carekit/shared/theme'
import { DEFAULT_THEME } from '@carekit/shared/types'
import type { ClinicTheme } from '@carekit/shared/types'

function injectTheme(theme: ClinicTheme): void {
  const css = generateCssVariables(theme)
  let el = document.getElementById('carekit-theme') as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = 'carekit-theme'
    document.head.appendChild(el)
  }
  el.textContent = css
}

function injectFont(fontUrl: string | null): void {
  document.getElementById('carekit-font')?.remove()
  if (!fontUrl) return
  const link = document.createElement('link')
  link.id   = 'carekit-font'
  link.rel  = 'stylesheet'
  link.href = fontUrl
  document.head.appendChild(link)
}

interface ThemeProviderProps {
  children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { data: theme } = useTheme()

  useLayoutEffect(() => {
    injectFont(DEFAULT_THEME.fontUrl)
    injectTheme(DEFAULT_THEME)
  }, [])

  useEffect(() => {
    if (!theme) return
    injectFont(theme.fontUrl)
    injectTheme(theme)
  }, [theme])

  return <>{children}</>
}
