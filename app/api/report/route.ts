import { NextResponse } from "next/server"

import { sendEmail, sendSlack, type NotifyResult } from "@/lib/server/notifier"
import { VESSEL_DATASET } from "@/lib/server/vessel-data"

type ReportSlot = "am" | "pm"

type LastReportMeta = {
  slot: ReportSlot
  generatedAt: string
  timezone: string
  sample: string
  sent: NotifyResult[]
}

const DEFAULT_TZ = "Asia/Dubai"
const REPORT_SLOTS: Record<ReportSlot, string> = {
  am: "06:00",
  pm: "17:00",
}

let lastReport: LastReportMeta | null = null

function resolveTimezone() {
  return process.env.REPORT_TIMEZONE || VESSEL_DATASET.timezone || DEFAULT_TZ
}

function inferSlot(now: Date, timezone: string): ReportSlot {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  })
  const hour = Number.parseInt(formatter.format(now), 10)
  return hour < 12 ? "am" : "pm"
}

function normaliseSlot(slotParam: string | null, now: Date, timezone: string): ReportSlot {
  if (slotParam === "am" || slotParam === "pm") {
    return slotParam
  }
  return inferSlot(now, timezone)
}

function relativeUrl(request: Request, path: string) {
  return new URL(path, request.url)
}

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url.toString(), { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url.pathname}: ${response.status}`)
  }
  return (await response.json()) as T
}

function formatMetric(value: number | null, unit: string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value.toFixed(2)} ${unit}`
  }
  return `n/a ${unit}`
}

function buildMarineLine(snapshot: any) {
  if (!snapshot) {
    return "[Marine Snapshot] 데이터 없음"
  }
  const hs = formatMetric(snapshot.hs ?? null, "m")
  const wind = formatMetric(snapshot.windKt ?? null, "kt")
  const ioi = typeof snapshot.ioi === "number" && Number.isFinite(snapshot.ioi) ? snapshot.ioi.toFixed(0) : "n/a"
  return `[Marine Snapshot] Hs ${hs} · Wind ${wind} · IOI ${ioi}`
}

function slackMessage(sample: string, slot: ReportSlot, timezone: string) {
  const label = slot === "am" ? "Morning" : "Evening"
  return [`*Daily Report – ${label} (${timezone})*`, sample].join("\n\n")
}

function emailSubject(vesselName: string, slot: ReportSlot, timezone: string) {
  const slotLabel = slot === "am" ? "06:00" : "17:00"
  return `${vesselName} 자동 브리핑 · ${slot.toUpperCase()} (${slotLabel} ${timezone})`
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const preview = url.searchParams.has("preview")
  const timezone = resolveTimezone()
  const now = new Date()

  if (preview) {
    return NextResponse.json({
      ok: lastReport?.sent.some((entry) => entry.ok) ?? false,
      preview: true,
      generatedAt: lastReport?.generatedAt ?? null,
      slot: lastReport?.slot ?? null,
      timezone,
      sample: lastReport?.sample ?? null,
      sent: lastReport?.sent ?? [],
    })
  }

  let vesselData: any
  try {
    vesselData = await fetchJson<any>(relativeUrl(request, "/api/vessel"))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch vessel data"
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }

  const slot = normaliseSlot(url.searchParams.get("slot"), now, timezone)

  let marineSnapshot: any = null
  try {
    const port = vesselData?.vessel?.port ?? VESSEL_DATASET.vessel.port
    const marineUrl = relativeUrl(request, `/api/marine?port=${encodeURIComponent(port)}`)
    marineSnapshot = await fetchJson<any>(marineUrl)
  } catch {
    marineSnapshot = null
  }

  let briefing: string
  try {
    const briefingUrl = relativeUrl(request, "/api/briefing")
    const payload = {
      current_time: now.toISOString(),
      vessel_name: vesselData?.vessel?.name,
      vessel_status: vesselData?.vessel?.status,
      current_voyage: vesselData?.schedule?.[0]?.id ?? null,
      schedule: vesselData?.schedule ?? [],
      weather_windows: vesselData?.weatherWindows ?? [],
    }
    const response = await fetch(briefingUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      throw new Error(`Briefing route responded ${response.status}`)
    }
    const data = (await response.json()) as { briefing?: string }
    briefing = data?.briefing ?? ""
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate briefing"
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }

  const marineLine = buildMarineLine(marineSnapshot)
  const sample = [briefing.trim(), "", marineLine].join("\n")

  const slackResult = await sendSlack({
    message: slackMessage(sample, slot, timezone),
  })

  const emailResult = await sendEmail({
    subject: emailSubject(vesselData?.vessel?.name ?? "Vessel", slot, timezone),
    text: sample,
  })

  const sent: NotifyResult[] = [slackResult, emailResult]
  const ok = sent.some((entry) => entry.ok)

  lastReport = {
    slot,
    generatedAt: now.toISOString(),
    timezone,
    sample,
    sent,
  }

  return NextResponse.json({
    ok,
    slot,
    generatedAt: lastReport.generatedAt,
    timezone,
    sample,
    sent,
    scheduleSize: vesselData?.schedule?.length ?? 0,
    marine: marineSnapshot ? { port: marineSnapshot.port ?? null } : { error: "n/a" },
    slotTime: REPORT_SLOTS[slot],
  })
}
