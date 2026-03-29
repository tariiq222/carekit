"use client"

import { useState, useEffect } from "react"

/**
 * Returns the current `dir` attribute on <html> and re-renders
 * whenever it changes (e.g. when the locale is toggled).
 */
export function useDocumentDir(): "ltr" | "rtl" {
  const [dir, setDir] = useState<"ltr" | "rtl">(() => {
    if (typeof document === "undefined") return "rtl"
    return (document.documentElement.dir as "ltr" | "rtl") || "rtl"
  })

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const next = (document.documentElement.dir as "ltr" | "rtl") || "rtl"
      setDir(next)
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["dir"],
    })

    return () => observer.disconnect()
  }, [])

  return dir
}
