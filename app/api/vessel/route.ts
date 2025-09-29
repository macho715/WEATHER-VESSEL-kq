import { NextResponse } from "next/server"

import { deriveVoyageIoi } from "@/lib/server/ioi"
import { VESSEL_DATASET } from "@/lib/server/vessel-data"

export async function GET() {
  const voyages = VESSEL_DATASET.schedule.map((voyage) => ({
    ...voyage,
    ioi: deriveVoyageIoi(voyage),
  }))

  return NextResponse.json({
    timezone: VESSEL_DATASET.timezone,
    vessel: VESSEL_DATASET.vessel,
    route: VESSEL_DATASET.route,
    schedule: voyages,
    weatherWindows: VESSEL_DATASET.weatherWindows,
    ports: VESSEL_DATASET.ports,
    events: VESSEL_DATASET.events,
    serverTime: new Date().toISOString(),
  })
}
