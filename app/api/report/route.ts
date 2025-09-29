import { NextResponse } from "next/server"

import { sendEmail, sendSlack, type ChannelResult } from "@/lib/server/notifier"
import { getLastReport, setLastReport } from "@/lib/server/report-state"
import { VESSEL_DATASET } from "@/lib/server/vessel-data"

const DEFAULT_TIMEZONE = process.env.REPORT_TIMEZONE ?? VESSEL_DATASET.timezone

type Slot = "am" | "pm"

type MarineSnapshot = {
  hs: number | null
  windKt: number | null
  ioi: number | null
  fetchedAt?: string
}

type VesselPayload = {
  timezone: string
  vessel: typeof VESSEL_DATASET.vessel
  schedule: Array<typeof VESSEL_DATASET.schedule[number] & { ioi?: number }>
  weatherWindows: typeof VESSEL_DATASET.weatherWindows
}

type BriefingResponse = {
  briefing?: string
}

function mapScheduleItem(voyage: (typeof VESSEL_DATASET.schedule)[number]) {
  return {
    ...voyage,
    swellFt: voyage.swellFt,
    windKt: voyage.windKt,
  }
}

function parseSlot(value: string | null): Slot | null {
  if (!value) return null
  return value === "am" || value === "pm" ? value : null
}

function determineSlot(date: Date, timezone: string): Slot {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: timezone,
  })
  const parts = formatter.formatToParts(date)
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0")
  return hour < 12 ? "am" : "pm"
}

function formatLocal(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

async function fetchJson<T>(url: URL, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, init)
    if (!response.ok) {
      return null
    }
    return (await response.json()) as T
  } catch (error) {
    console.error("report.fetch", url.toString(), error)
    return null
  }
}

function buildMarineSummary(snapshot: MarineSnapshot | null) {
  if (!snapshot) {
    return "[Marine Snapshot] n/a"
  }
  const hs = snapshot.hs != null ? snapshot.hs.toFixed(2) : "--"
  const wind = snapshot.windKt != null ? snapshot.windKt.toFixed(2) : "--"
  const ioi = snapshot.ioi != null ? snapshot.ioi.toFixed(0) : "n/a"
  return `[Marine Snapshot] Hs ${hs} m · Wind ${wind} kt · IOI ${ioi}`
}

function summariseChannels(results: ChannelResult[]) {
  return results.map((result) => ({
    channel: result.channel,
    ok: result.ok,
    status: result.status,
    id: result.id,
    error: result.error,
    skipped: result.skipped ?? false,
  }))
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const slot = parseSlot(requestUrl.searchParams.get("slot"))
  const vesselUrl = new URL("/api/vessel", requestUrl.origin)
  const vesselPayload = (await fetchJson<VesselPayload>(vesselUrl)) ?? {
    timezone: VESSEL_DATASET.timezone,
    vessel: VESSEL_DATASET.vessel,
    schedule: VESSEL_DATASET.schedule.map(mapScheduleItem),
    weatherWindows: VESSEL_DATASET.weatherWindows,
  }
  const timezone = vesselPayload.timezone ?? DEFAULT_TIMEZONE
  const now = new Date()
  const effectiveSlot = slot ?? determineSlot(now, timezone)

  const marineUrl = new URL("/api/marine", requestUrl.origin)
  marineUrl.searchParams.set("port", vesselPayload.vessel.port)
  const marinePayload = (await fetchJson<MarineSnapshot>(marineUrl)) ?? null

  const briefingUrl = new URL("/api/briefing", requestUrl.origin)
  const briefingPayload = await fetchJson<BriefingResponse>(briefingUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      current_time: now.toISOString(),
      vessel_name: vesselPayload.vessel.name,
      vessel_status: vesselPayload.vessel.status,
      current_voyage: vesselPayload.schedule[0]?.id ?? null,
      schedule: vesselPayload.schedule,
      weather_windows: vesselPayload.weatherWindows,
    }),
  })

  const marineSummary = buildMarineSummary(marinePayload)
  const briefing = briefingPayload?.briefing ?? `${vesselPayload.vessel.name} briefing unavailable.`
  const combined = `${briefing}\n\n${marineSummary}`

  const subject = `[Logistics] Daily briefing (${effectiveSlot.toUpperCase()}) – ${formatLocal(now, timezone)} (${timezone})`

  const slackResult = await sendSlack(combined)
  const emailResult = await sendEmail({
    subject,
    text: combined,
  })

  const sent = [slackResult, emailResult]
  const ok = sent.some((result) => result.ok)
  const previous = getLastReport()
  const record = {
    generatedAt: now.toISOString(),
    slot: effectiveSlot,
    ok,
    sent: summariseChannels(sent),
    sample: combined,
    timezone,
  }
  setLastReport(record)

  return NextResponse.json({
    ok,
    slot: effectiveSlot,
    generatedAt: record.generatedAt,
    timezone,
    sent: record.sent,
    sample: combined,
    previous,
  })
}
