import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { sendEmail, sendSlack } from "./notifier"

const originalEnv = { ...process.env }

describe("notifier", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  describe("sendSlack", () => {
    it("returns skipped when webhook is missing", async () => {
      const result = await sendSlack("hello", { webhookUrl: undefined })
      expect(result.ok).toBe(false)
      expect(result.skipped).toBe(true)
      expect(result.error).toContain("Slack webhook")
    })

    it("succeeds when webhook responds 200", async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
      vi.stubGlobal("fetch", mockFetch)

      const result = await sendSlack("hello", { webhookUrl: "https://example.com" })

      expect(result.ok).toBe(true)
      expect(result.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it("bubbles up response errors", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response("bad", { status: 500, statusText: "error" }),
      )
      vi.stubGlobal("fetch", mockFetch)

      const result = await sendSlack("hello", { webhookUrl: "https://example.com" })

      expect(result.ok).toBe(false)
      expect(result.status).toBe(500)
      expect(result.error).toContain("bad")
    })
  })

  describe("sendEmail", () => {
    beforeEach(() => {
      process.env.RESEND_API_KEY = "test-key"
      process.env.REPORT_SENDER = "no-reply@example.com"
      process.env.REPORT_RECIPIENTS = "ops@example.com"
    })

    it("reports missing API key", async () => {
      delete process.env.RESEND_API_KEY
      const result = await sendEmail({ subject: "hi", text: "body" })
      expect(result.ok).toBe(false)
      expect(result.skipped).toBe(true)
      expect(result.error).toContain("Resend API key")
    })

    it("reports missing recipients", async () => {
      process.env.REPORT_RECIPIENTS = ""
      const result = await sendEmail({ subject: "hi", text: "body" })
      expect(result.ok).toBe(false)
      expect(result.error).toContain("recipients")
    })

    it("returns metadata on success", async () => {
      const payload = { id: "email-123" }
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(payload), { status: 202 }))
      vi.stubGlobal("fetch", mockFetch)

      const result = await sendEmail({ subject: "hi", text: "body" })

      expect(result.ok).toBe(true)
      expect(result.id).toBe("email-123")
      expect(result.status).toBe(202)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it("captures API errors", async () => {
      const payload = { message: "failure" }
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(payload), { status: 500 }))
      vi.stubGlobal("fetch", mockFetch)

      const result = await sendEmail({ subject: "oops", text: "body" })

      expect(result.ok).toBe(false)
      expect(result.error).toContain("failure")
      expect(result.status).toBe(500)
    })
  })
})
