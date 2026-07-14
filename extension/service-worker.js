importScripts('config.js')

const ALARM_NAME = 'siftly-bookmark-sync'
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

async function runSync() {
  if (syncPromise) return syncPromise

  syncPromise = (async () => {
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

      for (let page = 0; page < (config().maxPages ?? 5); page++) {
        const fetched = await askForPage(tabInfo.tab.id, cursor)
        if (!fetched.tweets?.length) break

        const result = await uploadTweets(fetched.tweets)
        imported += result.imported ?? 0
        updated += result.updated ?? 0
        skipped += result.skipped ?? 0
        pages++

        // X returns newest first, so a page with no imports reaches known history.
        if ((result.imported ?? 0) === 0 || !fetched.nextCursor) break
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

function schedule() {
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: config().intervalMinutes ?? 240,
  })
}

chrome.runtime.onInstalled.addListener(() => {
  schedule()
  setTimeout(() => void runSync(), 1500)
})
chrome.runtime.onStartup.addListener(() => {
  schedule()
  setTimeout(() => void runSync(), 3000)
})
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) void runSync()
})
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'SIFTLY_SYNC_NOW') return false
  runSync()
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  return true
})

schedule()
