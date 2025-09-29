import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { GET } from "./route"
import { sendEmail, sendSlack } from "@/lib/server/notifier"
import { clearLastReport, getLastReport } from "@/lib/server/report-state"
import { VESSEL_DATASET } from "@/lib/server/vessel-data"

vi.mock("@/lib/server/notifier", () => ({
  sendSlack: vi.fn(),
  sendEmail: vi.fn(),
}))

const vesselResponse = {
  timezone: VESSEL_DATASET.timezone,
  vessel: VESSEL_DATASET.vessel,
  schedule: VESSEL_DATASET.schedule,
  weatherWindows: VESSEL_DATASET.weatherWindows,
}

const briefingResponse = {
  briefing: "Headline\nLine 2",
}

function buildMarineResponse() {
  return {
    hs: 1.23,
    windKt: 18.5,
    ioi: 74,
    fetchedAt: new Date().toISOString(),
  }
}

describe("/api/report", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-03-17T02:00:00Z"))
    process.env.REPORT_TIMEZONE = "Asia/Dubai"
    clearLastReport()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
    vi.unstubAllGlobals()
    clearLastReport()
  })

  function stubFetchSequence(options?: { skipMarine?: boolean }) {
    const marinePayload = options?.skipMarine ? null : buildMarineResponse()
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
      if (url.includes("/api/vessel")) {
        return new Response(JSON.stringify(vesselResponse), { status: 200 })
      }
      if (url.includes("/api/marine")) {
        if (!marinePayload) {
          return new Response("error", { status: 500 })
        }
        return new Response(JSON.stringify(marinePayload), { status: 200 })
      }
      if (url.includes("/api/briefing")) {
        return new Response(JSON.stringify(briefingResponse), { status: 200 })
      }
      return new Response("not found", { status: 404 })
    })
    vi.stubGlobal("fetch", fetchMock)
    return { fetchMock, marinePayload }
  }

  it("returns ok when both channels succeed", async () => {
    const { marinePayload } = stubFetchSequence()
    vi.mocked(sendSlack).mockResolvedValue({ channel: "slack", ok: true, status: 200 })
    vi.mocked(sendEmail).mockResolvedValue({ channel: "email", ok: true, status: 202 })

    const response = await GET(new Request("https://example.com/api/report?slot=am"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.slot).toBe("am")
    expect(body.sample).toContain("[Marine Snapshot]")
    if (marinePayload) {
      expect(body.sample).toContain(marinePayload.hs.toFixed(2))
    }
    const stored = getLastReport()
    expect(stored?.ok).toBe(true)
    expect(stored?.slot).toBe("am")
  })

  it("flags partial success when email fails", async () => {
    stubFetchSequence()
    vi.mocked(sendSlack).mockResolvedValue({ channel: "slack", ok: true, status: 200 })
    vi.mocked(sendEmail).mockResolvedValue({ channel: "email", ok: false, status: 500, error: "boom" })

    const response = await GET(new Request("https://example.com/api/report?slot=pm"))
    const body = await response.json()

    expect(body.ok).toBe(true)
    expect(body.sent).toHaveLength(2)
    const emailResult = body.sent.find((item: any) => item.channel === "email")
    expect(emailResult.ok).toBe(false)
    expect(emailResult.error).toBe("boom")
  })

  it("falls back when marine snapshot is unavailable", async () => {
    stubFetchSequence({ skipMarine: true })
    vi.mocked(sendSlack).mockResolvedValue({ channel: "slack", ok: true })
    vi.mocked(sendEmail).mockResolvedValue({ channel: "email", ok: true })

    const response = await GET(new Request("https://example.com/api/report"))
    const body = await response.json()

    expect(body.ok).toBe(true)
    expect(body.sample).toContain("[Marine Snapshot] n/a")
  })
})
