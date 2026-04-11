/* ─── Schedule shared types, constants, and utilities ─── */

export const DAY_NAMES_EN = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
] as const

export const DAY_NAMES_AR = [
  "الأحد", "الاثنين", "الثلاثاء", "الأربعاء",
  "الخميس", "الجمعة", "السبت",
] as const

export interface LocalBreak {
  key: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface LocalVacation {
  enabled: boolean
  startDate: string
  endDate: string
  reason: string
}

let breakKeyCounter = 0
export function nextBreakKey() {
  breakKeyCounter += 1
  return `brk-${breakKeyCounter}`
}
