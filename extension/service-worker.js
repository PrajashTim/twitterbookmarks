importScripts('config.js')

const ALARM_NAME = 'siftly-bookmark-sync'
const LAST_SYNC_ATTEMPT_KEY = 'siftlyLastSyncAttemptAt'
let syncPromise = null

function config() {
  return globalThis.SIFTLY_CONFIG ?? {}
}

async function saveStatus(status, details = {}) {
  const payload = { status, ...details, checkedAt: new Date().toISOString() }
  await chrome.storage.local.set({ siftlyStatus: payload })
  await chrome.action.setBadgeText({ text: status === 'success' ? '' : status === 'syncing' ? '...' : '!' })
  await chrome.action.setBadgeBackgroundColor({ color: status === 'error' ? '#ef4444' : '#22d3ee' })
}

function waitForTab(tabId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      reject(new Error('X took too long to load'))
    }, timeoutMs)

    function listener(updatedId, info) {
      if (updatedId !== tabId || info.status !== 'complete') return
      clearTimeout(timeout)
      chrome.tabs.onUpdated.removeListener(listener)
      resolve()
    }

    chrome.tabs.onUpdated.addListener(listener)
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status !== 'complete') return
      clearTimeout(timeout)
      chrome.tabs.onUpdated.removeListener(listener)
      resolve()
    }).catch(reject)
  })
}

async function getBookmarksTab() {
  const matches = await chrome.tabs.query({
    url: ['https://x.com/i/bookmarks*', 'https://twitter.com/i/bookmarks*'],
  })
  if (matches[0]?.id) return { tab: matches[0], temporary: false }

  const tab = await chrome.tabs.create({ url: 'https://x.com/i/bookmarks', active: false })
  if (!tab.id) throw new Error('Could not open X bookmarks')
  return { tab, temporary: true }
}

async function askForPage(tabId, cursor) {
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'SIFTLY_FETCH_PAGE', cursor })
      if (response?.ok) return response
      if (response?.error) throw new Error(response.error)
    } catch (error) {
      if (attempt === 11) throw error
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
  throw new Error('Could not communicate with the X bookmarks page')
}

async function uploadTweets(tweets) {
  const settings = config()
  if (!settings.token) throw new Error('Extension sync token is missing')

  const response = await fetch(settings.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tweets }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error ?? `Siftly returned ${response.status}`)
  return result
}

async function runSync({ maxPages = config().dailyMaxPages ?? 1, scanKnownHistory = false } = {}) {
  if (syncPromise) return syncPromise

  syncPromise = (async () => {
    await chrome.storage.local.set({ [LAST_SYNC_ATTEMPT_KEY]: Date.now() })
    await saveStatus('syncing')
    let tabInfo

    try {
      tabInfo = await getBookmarksTab()
      await waitForTab(tabInfo.tab.id)

      let cursor
      let imported = 0
      let updated = 0
      let skipped = 0
      let pages = 0

      for (let page = 0; page < maxPages; page++) {
        const fetched = await askForPage(tabInfo.tab.id, cursor)
        if (!fetched.tweets?.length) break

        const result = await uploadTweets(fetched.tweets)
        imported += result.imported ?? 0
        updated += result.updated ?? 0
        skipped += result.skipped ?? 0
        pages++

        // Daily sync only needs new bookmarks at the top. A manual backfill keeps
        // walking older pages so a new library can import its full history at once.
        if ((!scanKnownHistory && (result.imported ?? 0) === 0) || !fetched.nextCursor) break
        cursor = fetched.nextCursor
      }

      await saveStatus('success', { imported, updated, skipped, pages, syncedAt: new Date().toISOString() })
      return { imported, updated, skipped, pages }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await saveStatus('error', { error: message })
      throw error
    } finally {
      if (tabInfo?.temporary && tabInfo.tab.id) await chrome.tabs.remove(tabInfo.tab.id).catch(() => {})
    }
  })()

  try {
    return await syncPromise
  } finally {
    syncPromise = null
  }
}

async function runAutomaticSync() {
  const intervalMs = (config().intervalMinutes ?? 1440) * 60 * 1000
  const stored = await chrome.storage.local.get(LAST_SYNC_ATTEMPT_KEY)
  const lastSyncAttemptAt = Number(stored[LAST_SYNC_ATTEMPT_KEY] ?? 0)

  if (Date.now() - lastSyncAttemptAt < intervalMs) {
    await schedule()
    return { skipped: true, reason: 'not_due' }
  }

  return runSync()
}

async function schedule() {
  const intervalMinutes = config().intervalMinutes ?? 1440
  const intervalMs = intervalMinutes * 60 * 1000
  const stored = await chrome.storage.local.get(LAST_SYNC_ATTEMPT_KEY)
  const lastSyncAttemptAt = Number(stored[LAST_SYNC_ATTEMPT_KEY] ?? 0)
  const remainingMs = Math.max(0, intervalMs - (Date.now() - lastSyncAttemptAt))

  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: Math.max(1, Math.ceil(remainingMs / 60000)),
    periodInMinutes: intervalMinutes,
  })
}

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    const stored = await chrome.storage.local.get(LAST_SYNC_ATTEMPT_KEY)
    if (!stored[LAST_SYNC_ATTEMPT_KEY]) {
      // Installation never opens X unexpectedly. The first full import is manual.
      await chrome.storage.local.set({ [LAST_SYNC_ATTEMPT_KEY]: Date.now() })
    }
    await schedule()
  })()
})
chrome.runtime.onStartup.addListener(() => {
  void schedule()
  setTimeout(() => void runAutomaticSync(), 3000)
})
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) void runAutomaticSync()
})
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'SIFTLY_SYNC_NOW' && message?.type !== 'SIFTLY_SYNC_FULL') return false
  const isFullImport = message.type === 'SIFTLY_SYNC_FULL'
  runSync(
    isFullImport
      ? { maxPages: config().fullImportMaxPages ?? 30, scanKnownHistory: true }
      : undefined,
  )
    .then(async (result) => {
      await schedule()
      sendResponse({ ok: true, ...result })
    })
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  return true
})

void schedule()
