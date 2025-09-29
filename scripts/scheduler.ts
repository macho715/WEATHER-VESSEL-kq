import cron from "node-cron"
import fs from "node:fs"
import path from "node:path"

const timezone = process.env.REPORT_TIMEZONE ?? "Asia/Dubai"
const endpoint = process.env.REPORT_ENDPOINT ?? "http://localhost:3000/api/report"
const lockFile = process.env.REPORT_LOCK_PATH ?? path.join(process.cwd(), ".report.lock")

interface LockFile {
  slot: "am" | "pm"
  timestamp: number
}

function readLock(): LockFile | null {
  try {
    const raw = fs.readFileSync(lockFile, "utf8")
    return JSON.parse(raw) as LockFile
  } catch {
    return null
  }
}

function writeLock(data: LockFile) {
  fs.writeFileSync(lockFile, JSON.stringify(data), "utf8")
}

async function triggerReport(slot: "am" | "pm") {
  const last = readLock()
  const now = Date.now()
  if (last && last.slot === slot && now - last.timestamp < 5 * 60 * 1000) {
    console.log(`[scheduler] skipping ${slot} run – already executed within 5 minutes`)
    return
  }

  try {
    const response = await fetch(`${endpoint}?slot=${slot}`)
    const json = await response.json()
    if (!response.ok || !json?.ok) {
      console.warn(`[scheduler] ${slot} report responded with`, json)
    } else {
      writeLock({ slot, timestamp: now })
    }
    console.log(`[scheduler] ${slot} report`, json)
  } catch (error) {
    console.error(`[scheduler] failed to deliver ${slot} report`, error)
  }
}

console.log(`[scheduler] Starting cron jobs for ${timezone}`)

cron.schedule(
  "0 6 * * *",
  () => {
    void triggerReport("am")
  },
  { timezone }
)

cron.schedule(
  "0 17 * * *",
  () => {
    void triggerReport("pm")
  },
  { timezone }
)

console.log("[scheduler] Jobs registered: 06:00 and 17:00")
