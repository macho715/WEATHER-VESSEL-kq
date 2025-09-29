import { NextResponse } from "next/server"

import { deriveVoyageIoi } from "@/lib/server/ioi"
import { VESSEL_DATASET } from "@/lib/server/vessel-data"

const LOWER_PROMPT_MATCH = [
  { key: "weather", handler: buildWeatherInsight },
  { key: "risk", handler: buildRiskInsight },
  { key: "schedule", handler: buildRiskInsight },
]

export async function POST(request: Request) {
  const form = await request.formData()
  const prompt = String(form.get("prompt") ?? "").trim()
  const model = String(form.get("model") ?? "gpt-4.1-mini")
  const attachments = form
    .getAll("files")
    .map((item) => (item instanceof File ? item : null))
    .filter((file): file is File => Boolean(file))

  if (!prompt) {
    return NextResponse.json({ answer: "질문을 입력해주세요." })
  }

  const lower = prompt.toLowerCase()
  const handler = LOWER_PROMPT_MATCH.find((entry) => lower.includes(entry.key))?.handler
  const body = handler ? handler(prompt) : buildDefaultInsight(prompt)

  const attachmentLine = attachments.length
    ? `\n첨부 ${attachments.length}건: ${attachments.map((file) => file.name || "무제").join(", ")}`
    : ""

  return NextResponse.json({
    answer: `${body}\n모델: ${model}${attachmentLine}`,
  })
}

function buildWeatherInsight(_prompt: string) {
  const tz = VESSEL_DATASET.timezone
  const lines = VESSEL_DATASET.weatherWindows.map((window) => {
    const start = new Date(window.start)
    const end = new Date(window.end)
    const span = `${start.toLocaleString("ko-KR", { timeZone: tz, hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}` +
      ` – ${end.toLocaleString("ko-KR", { timeZone: tz, hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}`
    return `• ${span} · Hs ${window.wave_m.toFixed(2)} m · Wind ${window.wind_kt.toFixed(2)} kt · ${window.summary}`
  })

  return [
    "📡 최신 기상 창 요약",
    ...lines,
    "- 2.10 m 이상 파고 구간에서는 야간 창구 대기 6시간 확보",
    "- Warn 창에는 보조 예비 항로를 준비하세요.",
  ].join("\n")
}

function buildRiskInsight(_prompt: string) {
  const tz = VESSEL_DATASET.timezone
  const voyages = VESSEL_DATASET.schedule.map((voyage) => ({
    voyage,
    ioi: deriveVoyageIoi(voyage),
  }))
  const rows = voyages.map(({ voyage, ioi }) => {
    const bucket = ioi >= 75 ? "GO" : ioi >= 55 ? "WATCH" : "NO-GO"
    const etd = new Date(voyage.etd).toLocaleString("ko-KR", { timeZone: tz, hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })
    const eta = new Date(voyage.eta).toLocaleString("ko-KR", { timeZone: tz, hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })
    return `• ${voyage.id}: ${bucket} (${ioi.toFixed(0)} IOI) · ${etd} → ${eta}`
  })
  return [
    "🧭 IOI 및 스케줄 상태",
    ...rows,
    "- WATCH 이상 항차는 출항 6시간 전 현장 기상 재확인",
    "- NO-GO 항차는 Delay 24h 액션을 통해 자동 보류 가능합니다.",
  ].join("\n")
}

function buildDefaultInsight(prompt: string) {
  return `요청하신 내용("${prompt}")에 대해 추가 정보가 필요합니다. 스케줄, 기상, 위험 중 하나를 지정해 주세요.`
}
