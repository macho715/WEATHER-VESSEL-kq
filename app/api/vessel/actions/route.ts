import { NextResponse } from "next/server"

const ACTION_MESSAGES: Record<string, string> = {
  "quick-go": "선장이 즉시 출항을 승인했습니다.",
  "delay-24h": "항차가 24시간 연기되었습니다.",
  recalculate: "최신 기상 정보를 반영하여 경로를 재계산했습니다.",
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const action = String(body?.action ?? "")
  if (!action || !(action in ACTION_MESSAGES)) {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 })
  }

  const timestamp = new Date().toISOString()
  return NextResponse.json({
    ok: true,
    action,
    message: ACTION_MESSAGES[action],
    timestamp,
  })
}
