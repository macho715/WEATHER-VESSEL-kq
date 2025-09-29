import { describe, expect, it, vi } from "vitest"

import { sendEmail, sendSlack } from "@/lib/server/notifier"

describe("sendSlack", () => {
  it("returns ok when webhook responds 200", async () => {
    const mockFetch = vi.fn(async () => new Response(null, { status: 200 }))
    const result = await sendSlack({
      message: "Test message",
      webhookUrl: "https://hooks.slack.com/services/test",
      fetchImpl: mockFetch,
    })
    expect(result).toEqual({ channel: "slack", ok: true })
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it("reports failure when webhook rejects", async () => {
    const mockFetch = vi.fn(async () => new Response(null, { status: 500 }))
    const result = await sendSlack({
      message: "Test message",
      webhookUrl: "https://hooks.slack.com/services/test",
      fetchImpl: mockFetch,
    })
    expect(result.ok).toBe(false)
    expect(result.channel).toBe("slack")
    expect(result.error).toMatch(/500/)
  })

  it("fails gracefully when webhook missing", async () => {
    const result = await sendSlack({ message: "Hi" })
    expect(result).toEqual({
      ok: false,
      channel: "slack",
      error: "Missing Slack webhook URL",
    })
  })
})

describe("sendEmail", () => {
  it("succeeds when Resend returns 200", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"))
      expect(body.subject).toBe("Subject")
      expect(body.to).toEqual(["ops@example.com"])
      return new Response(JSON.stringify({ id: "email_123" }), { status: 200 })
    })
    const result = await sendEmail({
      subject: "Subject",
      text: "Body",
      fetchImpl: mockFetch,
      apiKey: "key",
      from: "no-reply@example.com",
      to: ["ops@example.com"],
    })
    expect(result).toEqual({ channel: "email", ok: true })
  })

  it("fails when Resend replies with non-2xx", async () => {
    const mockFetch = vi.fn(async () => new Response("boom", { status: 401 }))
    const result = await sendEmail({
      subject: "Subject",
      text: "Body",
      fetchImpl: mockFetch,
      apiKey: "key",
      from: "no-reply@example.com",
      to: ["ops@example.com"],
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/401/)
  })

  it("fails when recipients missing", async () => {
    const result = await sendEmail({
      subject: "Subject",
      text: "Body",
      apiKey: "key",
      from: "no-reply@example.com",
      to: [],
    })
    expect(result).toEqual({
      ok: false,
      channel: "email",
      error: "Missing email recipients",
    })
  })
})
