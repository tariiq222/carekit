import type { WhitelabelConfig } from '@carekit/api-client'

/**
 * Applies clinic white-label config to the DOM.
 * Called once after login and on app hydration.
 * direction and locale are set independently — they are not coupled.
 */
export function applyWhitelabel(config: WhitelabelConfig): void {
  const root = document.documentElement

  root.style.setProperty('--primary', config.primaryColor)
  root.style.setProperty('--accent', config.secondaryColor)

  root.setAttribute('dir', config.direction)
  root.setAttribute('lang', config.locale)

  if (config.fontFamily && config.fontFamily !== 'default') {
    loadGoogleFont(config.fontFamily)
    root.style.setProperty(
      '--font-sans',
      `'${config.fontFamily}', 'IBM Plex Sans Arabic', system-ui, sans-serif`,
    )
  }

  document.title = config.clinicNameAr || config.clinicName || 'CareKit'

  if (config.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = config.faviconUrl
  }
}

function loadGoogleFont(family: string): void {
  const encoded = encodeURIComponent(family)
  const id = `gfont-${encoded}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@300;400;500;600;700&display=swap`
  document.head.appendChild(link)
}
