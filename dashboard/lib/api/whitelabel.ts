/**
 * WhiteLabel API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type {
  WhiteLabelConfig,
  WhiteLabelConfigMap,
  UpdateConfigPayload,
} from "@/lib/types/whitelabel"

/* ─── Queries ─── */

export async function fetchConfig(): Promise<WhiteLabelConfig[]> {
  return api.get<WhiteLabelConfig[]>(
    "/whitelabel/config",
  )
}

export async function fetchConfigMap(): Promise<WhiteLabelConfigMap> {
  return api.get<WhiteLabelConfigMap>(
    "/whitelabel/config/map",
  )
}

export async function fetchConfigByKey(
  key: string,
): Promise<WhiteLabelConfig> {
  return api.get<WhiteLabelConfig>(
    `/whitelabel/config/${key}`,
  )
}

/* ─── Mutations ─── */

export async function updateConfig(
  payload: UpdateConfigPayload,
): Promise<WhiteLabelConfig[]> {
  return api.put<WhiteLabelConfig[]>(
    "/whitelabel/config",
    payload,
  )
}

export async function deleteConfig(key: string): Promise<void> {
  await api.delete(`/whitelabel/config/${key}`)
}
