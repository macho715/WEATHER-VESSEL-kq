import { NextResponse } from "next/server"

import { computeIoiFromMarine } from "@/lib/server/ioi"
import { VESSEL_DATASET } from "@/lib/server/vessel-data"

interface CachedMarine {
  snapshot: {
    hs: number | null
    windKt: number | null
    swellPeriod: number | null
    ioi: number | null
    fetchedAt: string
  }
  expiresAt: number
}

const cache = new Map<string, CachedMarine>()
const CACHE_TTL_MS = 10 * 60 * 1000
const FETCH_TIMEOUT_MS = 7 * 1000

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const port = searchParams.get("port") ?? VESSEL_DATASET.vessel.port
  const coords = VESSEL_DATASET.ports[port]

  if (!coords) {
    return NextResponse.json({ error: "Unknown port" }, { status: 400 })
  }

  const cached = cache.get(port)
  const now = Date.now()
  if (cached && cached.expiresAt > now) {
    return NextResponse.json({ port, coords, ...cached.snapshot, cached: true })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const params = new URLSearchParams({
      latitude: String(coords.lat),
      longitude: String(coords.lon),
      hourly: ["wave_height", "wind_speed_10m", "swell_wave_period"].join(","),
      timezone: "auto",
    })
    const response = await fetch(`https://marine-api.open-meteo.com/v1/marine?${params.toString()}`, {
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Marine API responded ${response.status}`)
    }

    const payload = await response.json()
    const hs = Number(payload?.hourly?.wave_height?.[0] ?? null)
    const windMs = Number(payload?.hourly?.wind_speed_10m?.[0] ?? null)
    const swellPeriod = Number(payload?.hourly?.swell_wave_period?.[0] ?? null)
    const windKt = Number.isFinite(windMs) ? windMs * 1.94384 : null

    const ioi = computeIoiFromMarine({ hs, windKt, swellPeriod })

    const snapshot = {
      hs: Number.isFinite(hs) ? hs : null,
      windKt: Number.isFinite(windKt) ? windKt : null,
      swellPeriod: Number.isFinite(swellPeriod) ? swellPeriod : null,
      ioi,
      fetchedAt: new Date().toISOString(),
    }

    cache.set(port, {
      snapshot,
      expiresAt: now + CACHE_TTL_MS,
    })

    return NextResponse.json({ port, coords, ...snapshot, cached: false })
  } catch (error) {
    if (cached) {
      return NextResponse.json({ port, coords, ...cached.snapshot, stale: true }, { status: 200 })
    }
    const message = error instanceof Error ? error.message : "Unknown marine error"
    return NextResponse.json({ error: message }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}
