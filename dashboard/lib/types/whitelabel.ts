/**
 * WhiteLabel Types — CareKit Dashboard
 */

/* ─── Entities ─── */

export type ConfigValueType = "string" | "number" | "boolean" | "json"

export interface WhiteLabelConfig {
  id: string
  key: string
  value: string
  type: ConfigValueType
  description: string | null
  createdAt: string
  updatedAt: string
}

export type WhiteLabelConfigMap = Record<string, string>

/* ─── DTOs ─── */

export interface UpsertConfigItem {
  key: string
  value: string
  type?: ConfigValueType
  description?: string
}

export interface UpdateConfigPayload {
  configs: UpsertConfigItem[]
}
