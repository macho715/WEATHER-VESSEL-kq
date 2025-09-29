export type NotifyChannel = "slack" | "email"

export interface NotifyResult {
  channel: NotifyChannel
  ok: boolean
  error?: string
}

interface SlackOptions {
  message: string
  webhookUrl?: string
  fetchImpl?: typeof fetch
}

interface EmailOptions {
  subject: string
  text: string
  to?: string[]
  from?: string
  apiKey?: string
  fetchImpl?: typeof fetch
}

function normaliseRecipients(list?: string[] | string) {
  if (!list) return []
  if (typeof list === "string") {
    return list
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  }
  return list
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

export async function sendSlack(options: SlackOptions): Promise<NotifyResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const webhook = options.webhookUrl ?? process.env.SLACK_WEBHOOK_URL
  if (!webhook) {
    return {
      channel: "slack",
      ok: false,
      error: "Missing Slack webhook URL",
    }
  }

  try {
    const response = await fetchImpl(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: options.message }),
    })
    if (!response.ok) {
      return {
        channel: "slack",
        ok: false,
        error: `Slack webhook responded ${response.status}`,
      }
    }
    return { channel: "slack", ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Slack webhook error"
    return { channel: "slack", ok: false, error: message }
  }
}

export async function sendEmail(options: EmailOptions): Promise<NotifyResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const recipients = normaliseRecipients(options.to ?? process.env.REPORT_RECIPIENTS?.split(","))
  if (!recipients.length) {
    return { channel: "email", ok: false, error: "Missing email recipients" }
  }

  const apiKey = options.apiKey ?? process.env.RESEND_API_KEY
  if (!apiKey) {
    return { channel: "email", ok: false, error: "Missing Resend API key" }
  }

  const sender = options.from ?? process.env.REPORT_SENDER
  if (!sender) {
    return { channel: "email", ok: false, error: "Missing report sender address" }
  }

  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
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
    })

    if (!response.ok) {
      return {
        channel: "email",
        ok: false,
        error: `Resend responded ${response.status}`,
      }
    }

    return { channel: "email", ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resend request failed"
    return { channel: "email", ok: false, error: message }
  }
}
