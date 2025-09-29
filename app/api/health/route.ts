import { NextResponse } from "next/server"

import { getLastReport } from "@/lib/server/report-state"

export async function GET() {
  const report = getLastReport()
  const status = report && !report.ok ? "degraded" : "ok"

  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    report,
  })
}
