/**
 * CareKit Booking Widget — Embed Script
 *
 * Usage:
 *   <script src="/widget/embed.js"
 *     data-practitioner="UUID"
 *     data-service="UUID"
 *     data-locale="ar">
 *   </script>
 *
 * Or programmatically:
 *   CareKitWidget.open({ practitioner: 'UUID', locale: 'en' })
 */

;(function () {
  var WIDGET_BASE = (function () {
    var scripts = document.getElementsByTagName('script')
    var src = scripts[scripts.length - 1].src
    return src.replace('/widget/embed.js', '')
  })()

  var currentFrame = null

  function buildUrl(opts) {
    var params = new URLSearchParams()
    if (opts.practitioner) params.set('practitioner', opts.practitioner)
    if (opts.service) params.set('service', opts.service)
    if (opts.locale) params.set('locale', opts.locale)
    return WIDGET_BASE + '/booking?' + params.toString()
  }

  function createFrame(opts) {
    var overlay = document.createElement('div')
    overlay.id = 'carekit-widget-overlay'
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:99999',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(0,0,0,0.4)', 'backdrop-filter:blur(4px)',
    ].join(';')

    var frame = document.createElement('iframe')
    frame.src = buildUrl(opts)
    frame.style.cssText = [
      'width:440px', 'max-width:calc(100vw - 32px)',
      'height:680px', 'max-height:calc(100vh - 32px)',
      'border:none', 'border-radius:16px',
      'box-shadow:0 24px 80px rgba(0,0,0,0.3)',
      'background:#fff',
    ].join(';')
    frame.setAttribute('allow', 'payment')
    frame.setAttribute('title', 'Booking Widget')

    overlay.onclick = function (e) {
      if (e.target === overlay) CareKitWidget.close()
    }

    overlay.appendChild(frame)
    document.body.appendChild(overlay)
    currentFrame = frame
    return frame
  }

  function handleMessage(event) {
    var data = event.data
    if (!data || typeof data.type !== 'string') return
    if (!data.type.startsWith('carekit:')) return

    if (data.type === 'carekit:widget:close') {
      CareKitWidget.close()
    }

    if (data.type === 'carekit:widget:resize' && currentFrame && data.height) {
      var maxH = window.innerHeight - 32
      currentFrame.style.height = Math.min(data.height, maxH) + 'px'
    }

    if (listeners[data.type]) {
      listeners[data.type].forEach(function (fn) { fn(data) })
    }
  }

  window.addEventListener('message', handleMessage)

  var listeners = {}

  window.CareKitWidget = {
    open: function (opts) {
      opts = opts || {}
      if (!opts.practitioner) {
        var s = document.currentScript || document.querySelector('script[data-practitioner]')
        if (s) {
          opts.practitioner = s.getAttribute('data-practitioner') || undefined
          opts.service = s.getAttribute('data-service') || undefined
          opts.locale = s.getAttribute('data-locale') || 'ar'
        }
      }
      if (document.getElementById('carekit-widget-overlay')) return
      createFrame(opts)
    },

    close: function () {
      var overlay = document.getElementById('carekit-widget-overlay')
      if (overlay) overlay.remove()
      currentFrame = null
    },

    on: function (eventType, callback) {
      if (!listeners[eventType]) listeners[eventType] = []
      listeners[eventType].push(callback)
    },

    off: function (eventType, callback) {
      if (!listeners[eventType]) return
      listeners[eventType] = listeners[eventType].filter(function (fn) { return fn !== callback })
    },
  }

  /* Auto-open if data-auto-open attribute is set */
  document.addEventListener('DOMContentLoaded', function () {
    var s = document.querySelector('script[src*="embed.js"][data-auto-open]')
    if (s) CareKitWidget.open()
  })
})()
