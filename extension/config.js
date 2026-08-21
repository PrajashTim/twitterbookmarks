globalThis.SIFTLY_CONFIG = {
  endpoint: 'https://twitterbookmarks.vercel.app/api/sync/bookmarks',
  token: '',
  intervalMinutes: 1440,
  dailyMaxPages: 1,
  fullImportMaxPages: 30,
}

try {
  importScripts('config.local.js')
} catch {
  // The local token file is generated on this computer and is not committed.
}
