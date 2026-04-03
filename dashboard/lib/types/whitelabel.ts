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

export interface WhiteLabelConfigMap {
  [key: string]: string | undefined
  date_format?: string
  time_format?: string
  week_start_day?: string
  timezone?: string
}

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
