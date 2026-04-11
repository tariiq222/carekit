"use client"

import { usePathname } from "next/navigation"

interface PageTransitionProps {
  children: React.ReactNode
}

/**
 * Wraps page content and uses `usePathname()` as the key so each navigation
 * re-mounts the element.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()

  return (
    <div key={pathname} className="w-full">
      {children}
    </div>
  )
}
