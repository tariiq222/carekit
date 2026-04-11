/**
 * Runs API — MultiAgent Control Panel
 *
 * Note: resume endpoint does not exist yet.
 */

import { api } from "@/lib/api"
import type { Run } from "@/lib/types/runs"

export async function fetchRun(runId: string): Promise<Run> {
  return api.get(`/runs/${runId}`)
}

export async function pauseRun(runId: string): Promise<void> {
  return api.post(`/runs/${runId}/pause`, {})
}

export async function cancelRun(runId: string): Promise<void> {
  return api.post(`/runs/${runId}/cancel`, {})
}
