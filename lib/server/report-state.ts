import type { ChannelResult } from "./notifier"

export interface ReportRecord {
  generatedAt: string
  slot: "am" | "pm"
  ok: boolean
  sent: ChannelResult[]
  sample: string
  timezone: string
}

let lastReport: ReportRecord | null = null

export function setLastReport(record: ReportRecord) {
  lastReport = record
}

export function getLastReport(): ReportRecord | null {
  return lastReport
}

export function clearLastReport() {
  lastReport = null
}
