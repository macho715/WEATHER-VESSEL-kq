import { beforeEach, describe, expect, it, vi } from "vitest"

declare const global: typeof globalThis & { fetch: typeof fetch }

async function importRoute() {
  return import("@/app/api/report/route")
}

const vesselPayload = {
  timezone: "Asia/Dubai",
  vessel: {
    name: "JOPETWIL 71",
    status: "Ready @ MW4",
  },
  schedule: [
    { id: "69th", cargo: "Dune Sand", etd: "2025-09-28T16:00:00Z", eta: "2025-09-29T04:00:00Z", status: "Scheduled" },
  ],
  weatherWindows: [],
}

const marineSnapshot = {
  port: "Jebel Ali",
  hs: 1.2,
  windKt: 15.4,
  swellPeriod: 8.1,
  ioi: 82,
  fetchedAt: "2025-09-28T12:00:00Z",
}

const briefingResponse = {
  briefing: "Headline\nBody",
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2025-09-28T02:00:00Z"))
  process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/test"
  process.env.RESEND_API_KEY = "test"
  process.env.REPORT_SENDER = "no-reply@example.com"
  process.env.REPORT_RECIPIENTS = "ops@example.com"
  process.env.REPORT_TIMEZONE = "Asia/Dubai"
})

describe("GET /api/report", () => {
  it("sends notifications and returns combined payload", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
      if (url.includes("/api/vessel")) {
        return new Response(JSON.stringify(vesselPayload), { status: 200 })
      }
      if (url.includes("/api/marine")) {
        return new Response(JSON.stringify(marineSnapshot), { status: 200 })
      }
      if (url.includes("/api/briefing")) {
        return new Response(JSON.stringify(briefingResponse), { status: 200 })
      }
      if (url.includes("hooks.slack.com")) {
        return new Response(null, { status: 200 })
      }
      if (url.includes("api.resend.com")) {
        return new Response(JSON.stringify({ id: "email_1" }), { status: 200 })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    global.fetch = fetchMock as typeof fetch

    const { GET } = await importRoute()
    const response = await GET(new Request("http://localhost/api/report"))
    const json = await response.json()

    expect(json.ok).toBe(true)
    expect(json.sample).toContain("[Marine Snapshot]")
    expect(json.sent).toEqual([
      { channel: "slack", ok: true },
      { channel: "email", ok: true },
    ])
  })

  it("survives email failure and records error", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
      if (url.includes("/api/vessel")) {
        return new Response(JSON.stringify(vesselPayload), { status: 200 })
      }
      if (url.includes("/api/marine")) {
        return new Response(JSON.stringify(marineSnapshot), { status: 200 })
      }
      if (url.includes("/api/briefing")) {
        return new Response(JSON.stringify(briefingResponse), { status: 200 })
      }
      if (url.includes("hooks.slack.com")) {
        return new Response(null, { status: 200 })
      }
      if (url.includes("api.resend.com")) {
        return new Response("fail", { status: 500 })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    global.fetch = fetchMock as typeof fetch

    const { GET } = await importRoute()
    const response = await GET(new Request("http://localhost/api/report?slot=pm"))
    const json = await response.json()

    expect(json.ok).toBe(true)
    expect(json.slot).toBe("pm")
    expect(json.sent).toEqual([
      { channel: "slack", ok: true },
      { channel: "email", ok: false, error: expect.stringMatching(/500/) },
    ])
  })

  it("returns preview metadata without sending when requested", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 500 }))
    global.fetch = fetchMock as typeof fetch

    const { GET } = await importRoute()
    const response = await GET(new Request("http://localhost/api/report?preview=1"))
    const json = await response.json()

    expect(json.preview).toBe(true)
    expect(json.ok).toBe(false)
  })
})
