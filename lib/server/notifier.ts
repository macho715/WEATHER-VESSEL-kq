const DEFAULT_TIMEOUT_MS = 8000

export interface ChannelResult {
  channel: "slack" | "email"
  ok: boolean
  status?: number
  id?: string
  error?: string
  skipped?: boolean
}

export interface SlackOptions {
  webhookUrl?: string
  timeoutMs?: number
  username?: string
}

export async function sendSlack(
  message: string,
  options: SlackOptions = {},
): Promise<ChannelResult> {
  const webhookUrl = options.webhookUrl ?? process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    return {
      channel: "slack",
      ok: false,
      skipped: true,
      error: "Slack webhook not configured",
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const payload = {
      text: message,
      username: options.username ?? "Logistics Control Tower",
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    const ok = response.ok
    const status = response.status

    if (!ok) {
      const text = await response.text().catch(() => "")
      return {
        channel: "slack",
        ok: false,
        status,
        error: text || `Slack responded with ${status}`,
      }
    }

    return {
      channel: "slack",
      ok: true,
      status,
    }
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Unknown Slack error"
    return {
      channel: "slack",
      ok: false,
      error: messageText,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export interface EmailOptions {
  apiKey?: string
  sender?: string
  recipients?: string[]
  subject: string
  text: string
  timeoutMs?: number
}

export async function sendEmail(options: EmailOptions): Promise<ChannelResult> {
  const apiKey = options.apiKey ?? process.env.RESEND_API_KEY
  const sender = options.sender ?? process.env.REPORT_SENDER
  const recipients = options.recipients ?? (process.env.REPORT_RECIPIENTS?.split(/[,\n]/).map((value) => value.trim()).filter(Boolean) ?? [])

  if (!apiKey) {
    return {
      channel: "email",
      ok: false,
      skipped: true,
      error: "Resend API key not configured",
    }
  }

  if (!sender) {
    return {
      channel: "email",
      ok: false,
      error: "Report sender address missing",
    }
  }

  if (!recipients.length) {
    return {
      channel: "email",
      ok: false,
      error: "Report recipients missing",
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: sender,
        to: recipients,
        subject: options.subject,
        text: options.text,
      }),
      signal: controller.signal,
    })

    const status = response.status
    const payload = await response.json().catch(() => ({})) as { id?: string; message?: string }

    if (!response.ok) {
      return {
        channel: "email",
        ok: false,
        status,
        error: payload?.message ?? `Resend responded with ${status}`,
      }
    }

    return {
      channel: "email",
      ok: true,
      status,
      id: payload?.id,
    }
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Unknown email error"
    return {
      channel: "email",
      ok: false,
      error: messageText,
    }
  } finally {
    clearTimeout(timeout)
  }
}
