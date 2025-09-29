#!/usr/bin/env node
// @ts-nocheck
/* eslint-disable no-console */
const cron = require('node-cron')
const fs = require('fs/promises')
const path = require('path')

const TIMEZONE = process.env.REPORT_TIMEZONE || 'Asia/Dubai'
const ENDPOINT = process.env.REPORT_ENDPOINT || 'http://localhost:3000/api/report'
const LOCK_PATH = path.resolve(process.env.REPORT_LOCK_FILE || '.weather-vessel-report.lock')
const LOCK_TTL_MS = 10 * 60 * 1000

/**
 * @typedef {Record<string, string>} LockMap
 */

/** @returns {Promise<LockMap>} */
async function readLock() {
  try {
    const raw = await fs.readFile(LOCK_PATH, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    return {}
  }
}

/** @param {LockMap} lock */
async function writeLock(lock) {
  await fs.writeFile(LOCK_PATH, JSON.stringify(lock, null, 2))
}

/**
 * @param {LockMap} lock
 * @param {"am"|"pm"} slot
 */
async function shouldSkip(lock, slot) {
  const entry = lock[slot]
  if (!entry) return false
  const last = new Date(entry)
  if (Number.isNaN(last.valueOf())) return false
  return Date.now() - last.valueOf() < LOCK_TTL_MS
}

/** @param {"am"|"pm"} slot */
async function triggerReport(slot) {
  const lock = await readLock()
  if (await shouldSkip(lock, slot)) {
    console.log(`[scheduler] ${slot} report skipped (recent execution)`)
    return
  }

  lock[slot] = new Date().toISOString()
  await writeLock(lock)

  const url = `${ENDPOINT}?slot=${slot}`
  console.log(`[scheduler] Dispatching ${slot.toUpperCase()} report via ${url}`)
  try {
    const response = await fetch(url)
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.error(`[scheduler] Report dispatch failed: HTTP ${response.status}`, payload)
      return
    }
    if (payload?.ok) {
      const summary = Array.isArray(payload.sent)
        ? /** @type {{ channel: string; ok: boolean }[]} */ (payload.sent).map(
            (item) => `${item.channel}:${item.ok ? 'ok' : 'err'}`,
          ).join(', ')
        : 'no-summary'
      console.log(`[scheduler] Report sent successfully (${summary})`)
    } else {
      console.warn('[scheduler] Report responded with partial failure', payload)
    }
  } catch (error) {
    console.error('[scheduler] Report dispatch error', error)
  }
}

console.log(`[scheduler] Starting with timezone ${TIMEZONE} targeting ${ENDPOINT}`)

cron.schedule('0 6 * * *', () => triggerReport('am'), { timezone: TIMEZONE })
cron.schedule('0 17 * * *', () => triggerReport('pm'), { timezone: TIMEZONE })

console.log('[scheduler] Schedules registered for 06:00 and 17:00 local time')

triggerReport('am').catch((error) => console.error('[scheduler] Initial trigger failed', error))

process.on('SIGINT', () => {
  console.log('\n[scheduler] Stopping')
  process.exit(0)
})
