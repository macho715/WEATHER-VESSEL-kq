export interface VoyageRecord {
  id: string
  cargo: string
  etd: string
  eta: string
  status: "Scheduled" | "Delayed" | "In Transit" | "Completed"
  origin: string
  destination: string
  swellFt: number
  windKt: number
}

export interface WeatherWindowRecord {
  start: string
  end: string
  wave_m: number
  wind_kt: number
  vis_km: number
  summary: string
}

export interface EventRecord {
  timestamp: string
  level: "info" | "warn" | "error"
  message: string
}

export interface VesselDataset {
  timezone: string
  vessel: {
    name: string
    imo: string
    mmsi: string
    readiness: string
    status: string
    port: string
  }
  route: Array<[number, number]>
  schedule: VoyageRecord[]
  weatherWindows: WeatherWindowRecord[]
  ports: Record<string, { lat: number; lon: number }>
  events: EventRecord[]
}

export const VESSEL_DATASET: VesselDataset = {
  timezone: "Asia/Dubai",
  vessel: {
    name: "JOPETWIL 71",
    imo: "9582829",
    mmsi: "470486000",
    readiness: "Ready @ MW4",
    status: "Ready @ MW4",
    port: "Jebel Ali",
  },
  route: [
    [24.3400, 54.4500],
    [24.4300, 54.4300],
    [24.4700, 54.3900],
    [24.5600, 54.2000],
    [24.6500, 54.0000],
    [24.8500, 53.8000],
    [24.9500, 53.7400],
    [24.9500, 53.3000],
    [25.0200, 53.0600],
    [24.8400, 53.6500],
  ],
  schedule: [
    {
      id: "69th",
      cargo: "Dune Sand",
      etd: "2025-09-28T16:00:00Z",
      eta: "2025-09-29T04:00:00Z",
      status: "Scheduled",
      origin: "MW4",
      destination: "AGI",
      swellFt: 6.1,
      windKt: 18.0,
    },
    {
      id: "70th",
      cargo: "10mm Agg.",
      etd: "2025-09-30T16:00:00Z",
      eta: "2025-10-01T04:00:00Z",
      status: "Scheduled",
      origin: "MW4",
      destination: "AGI",
      swellFt: 4.3,
      windKt: 14.8,
    },
    {
      id: "71st",
      cargo: "5mm Agg.",
      etd: "2025-10-02T16:00:00Z",
      eta: "2025-10-03T04:00:00Z",
      status: "Scheduled",
      origin: "MW4",
      destination: "AGI",
      swellFt: 3.2,
      windKt: 11.6,
    },
  ],
  weatherWindows: [
    {
      start: "2025-09-28T12:00:00Z",
      end: "2025-09-29T06:00:00Z",
      wave_m: 2.10,
      wind_kt: 26.0,
      vis_km: 6.4,
      summary: "모래폭풍 가능성 – 야간 입항 지연 권고",
    },
    {
      start: "2025-09-30T00:00:00Z",
      end: "2025-10-01T08:00:00Z",
      wave_m: 1.45,
      wind_kt: 18.2,
      vis_km: 9.1,
      summary: "잔잔한 북서풍 – 정상 창",
    },
    {
      start: "2025-10-02T08:00:00Z",
      end: "2025-10-03T12:00:00Z",
      wave_m: 0.95,
      wind_kt: 12.3,
      vis_km: 11.0,
      summary: "양호 – 예비 창",
    },
  ],
  ports: {
    "Jebel Ali": { lat: 25.006, lon: 55.065 },
    "Khor Fakkan": { lat: 25.3391, lon: 56.3644 },
    "Ras Al Khaimah": { lat: 25.7895, lon: 55.9428 },
    Singapore: { lat: 1.3521, lon: 103.8198 },
  },
  events: [
    {
      timestamp: "2025-09-28T12:05:00Z",
      level: "info",
      message: "시뮬레이터 부팅 – 해상 관측 연결됨",
    },
    {
      timestamp: "2025-09-28T12:10:00Z",
      level: "info",
      message: "CSV 스케줄 3건 로드",
    },
    {
      timestamp: "2025-09-28T12:15:00Z",
      level: "warn",
      message: "69th 항차 야간 창구 혼잡 예보",
    },
  ],
}
