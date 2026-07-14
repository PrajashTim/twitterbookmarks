globalThis.SIFTLY_CONFIG = {
  endpoint: 'https://twitterbookmarks.vercel.app/api/sync/bookmarks',
  token: '',
  intervalMinutes: 240,
  maxPages: 5,
}

try {
  importScripts('config.local.js')
} catch {
  // The local token file is generated on this computer and is not committed.
}
