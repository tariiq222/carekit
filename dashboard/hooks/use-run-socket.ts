"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { io, type Socket } from "socket.io-client"
import type {
  LogLine,
  RunStatus,
  StageStatusUpdate,
  RunStatusEvent,
  StageStatusEvent,
} from "@/lib/types/runs"

const TERMINAL_STATUSES: RunStatus[] = ["PASSED", "FAILED", "CANCELLED"]

function getSocketBase(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100/api/v1"
  return apiUrl.replace(/\/api$/, "")
}

interface UseRunSocketOptions {
  runId: string
  enabled?: boolean
}

export function useRunSocket({ runId, enabled = true }: UseRunSocketOptions) {
  const [logLines, setLogLines] = useState<LogLine[]>([])
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null)
  const [currentStageIndex, setCurrentStageIndex] = useState<number | null>(null)
  const [stageUpdates, setStageUpdates] = useState<Map<string, StageStatusUpdate>>(new Map())

  const isMountedRef = useRef(true)
  const socketRef = useRef<Socket | null>(null)

  const handleLog = useCallback((data: LogLine) => {
    if (!isMountedRef.current) return
    setLogLines((prev) => [...prev, data])
  }, [])

  const handleRunStatus = useCallback((data: RunStatusEvent) => {
    if (!isMountedRef.current) return
    setRunStatus(data.status)
    if (data.currentStageIndex !== undefined) {
      setCurrentStageIndex(data.currentStageIndex)
    }
  }, [])

  const handleStageStatus = useCallback((data: StageStatusEvent) => {
    if (!isMountedRef.current) return
    setStageUpdates((prev) => {
      const next = new Map(prev)
      next.set(data.stageId, { stageId: data.stageId, status: data.status, agentId: data.agentId })
      return next
    })
  }, [])

  useEffect(() => {
    isMountedRef.current = true

    if (!enabled || !runId) return

    const socket = io(`${getSocketBase()}/runs`, {
      transports: ["websocket"],
      autoConnect: true,
    })

    socketRef.current = socket

    socket.on("connect", () => {
      if (!isMountedRef.current) return
      socket.emit("join", { runId })
    })

    socket.on("log", handleLog)
    socket.on("run:status", handleRunStatus)
    socket.on("stage:status", handleStageStatus)

    socket.on("disconnect", () => {
      if (!isMountedRef.current) return
    })

    return () => {
      isMountedRef.current = false
      socket.off("log", handleLog)
      socket.off("run:status", handleRunStatus)
      socket.off("stage:status", handleStageStatus)
      socket.disconnect()
      socketRef.current = null
    }
  }, [runId, enabled, handleLog, handleRunStatus, handleStageStatus])

  return {
    logLines,
    runStatus,
    currentStageIndex,
    stageUpdates,
    isConnected: socketRef.current?.connected ?? false,
  }
}

export { TERMINAL_STATUSES }
