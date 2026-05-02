'use client'

import posthog from 'posthog-js'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    posthog.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <h2>Something went wrong</h2>
      </body>
    </html>
  )
}
