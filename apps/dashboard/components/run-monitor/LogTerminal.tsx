"use client"

import { useEffect, useRef, useState } from "react"
import type { LogLine } from "@/lib/types/runs"

interface LogTerminalProps {
  lines: LogLine[]
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export function LogTerminal({ lines }: LogTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const isUserScrollingRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      if (!container) return
      const { scrollTop, scrollHeight, clientHeight } = container
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
      isUserScrollingRef.current = !isAtBottom
      setAutoScroll(isAtBottom)
    }

    container.addEventListener("scroll", handleScroll)
    return () => container.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    if (!autoScroll || !containerRef.current) return
    containerRef.current.scrollTop = containerRef.current.scrollHeight
  }, [lines, autoScroll])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Logs</h2>
        {!autoScroll && (
          <span className="text-xs text-warning">Scroll paused — showing latest</span>
        )}
      </div>
      <div
        ref={containerRef}
        className="flex flex-col gap-0.5 overflow-y-auto rounded-lg border border-border bg-[var(--surface)] p-4 font-mono text-xs"
        style={{ fontFamily: "monospace", minHeight: "200px", maxHeight: "400px" }}
      >
        {lines.length === 0 ? (
          <span className="text-muted-foreground">Waiting for logs...</span>
        ) : (
          lines.map((logLine, index) => (
            <div key={index} className="flex gap-3">
              <span className="text-muted-foreground shrink-0">
                [{formatTimestamp(logLine.timestamp)}]
              </span>
              {logLine.stageId && (
                <span className="text-info shrink-0">[{logLine.stageId.slice(0, 8)}]</span>
              )}
              <span className="text-foreground">{logLine.line}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
