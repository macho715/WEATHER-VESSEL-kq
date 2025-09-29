import { VoyageRecord } from "./vessel-data"

export interface MarineSnapshot {
  hs?: number | null
  windKt?: number | null
  swellPeriod?: number | null
  ioi?: number | null
}

const HS_CAUTION = 1.5
const HS_NOGO = 2.5
const WIND_CAUTION = 18
const WIND_NOGO = 28
const SWELL_MIN = 6
const SWELL_MAX = 12

export function computeIoiFromMarine(snapshot: MarineSnapshot): number | null {
  const hs = snapshot.hs ?? null
  const wind = snapshot.windKt ?? null
  const period = snapshot.swellPeriod ?? null

  const hsScore =
    hs === null || Number.isNaN(hs)
      ? 0.5
      : hs <= HS_CAUTION
        ? 1
        : hs >= HS_NOGO
          ? 0
          : 1 - (hs - HS_CAUTION) / (HS_NOGO - HS_CAUTION)

  const windScore =
    wind === null || Number.isNaN(wind)
      ? 0.5
      : wind <= WIND_CAUTION
        ? 1
        : wind >= WIND_NOGO
          ? 0
          : 1 - (wind - WIND_CAUTION) / (WIND_NOGO - WIND_CAUTION)

  const boundedPeriod = Math.min(SWELL_MAX, Math.max(SWELL_MIN, period ?? 8))
  const swellScore = (boundedPeriod - SWELL_MIN) / (SWELL_MAX - SWELL_MIN)

  const combined = 0.5 * hsScore + 0.35 * windScore + 0.15 * swellScore
  const ioi = Math.round(combined * 100)
  return Math.max(0, Math.min(100, ioi))
}

export function deriveVoyageIoi(voyage: VoyageRecord): number {
  const hs = voyage.swellFt / 3.28084
  const snapshot: MarineSnapshot = {
    hs,
    windKt: voyage.windKt,
    swellPeriod: 8,
  }
  return computeIoiFromMarine(snapshot) ?? 50
}
