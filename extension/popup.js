const statusElement = document.querySelector('#status')
const detailsElement = document.querySelector('#details')
const syncButton = document.querySelector('#sync')
const fullSyncButton = document.querySelector('#full-sync')

function render(status) {
  if (!status) {
    statusElement.textContent = 'Automatic sync is ready.'
    detailsElement.textContent = 'Chrome syncs automatically at most once every 24 hours.'
    return
  }
  if (status.status === 'syncing') {
    statusElement.textContent = 'Syncing with X...'
    detailsElement.textContent = 'This normally takes a few seconds.'
    return
  }
  if (status.status === 'error') {
    statusElement.textContent = 'Sync needs attention.'
    detailsElement.textContent = status.error ?? 'Open X and make sure you are signed in.'
    return
  }

  statusElement.textContent = 'Your library is up to date.'
  const when = status.syncedAt ? new Date(status.syncedAt).toLocaleString() : 'just now'
  detailsElement.textContent = `${status.imported ?? 0} new, ${status.updated ?? 0} refreshed. Last check: ${when}.`
}

chrome.storage.local.get('siftlyStatus').then(({ siftlyStatus }) => render(siftlyStatus))
async function startSync(messageType) {
  syncButton.disabled = true
  fullSyncButton.disabled = true
  syncButton.textContent = messageType === 'SIFTLY_SYNC_NOW' ? 'Syncing...' : 'Sync latest bookmarks'
  fullSyncButton.textContent = messageType === 'SIFTLY_SYNC_FULL' ? 'Importing...' : 'Import full library'
  statusElement.textContent = 'Syncing with X...'
  detailsElement.textContent = messageType === 'SIFTLY_SYNC_FULL'
    ? 'Reading your X bookmark history. Keep Chrome open until this finishes.'
    : 'Checking the newest bookmarks.'
  const result = await chrome.runtime.sendMessage({ type: messageType })
  const { siftlyStatus } = await chrome.storage.local.get('siftlyStatus')
  render(siftlyStatus ?? (result.ok ? { status: 'success', ...result } : { status: 'error', error: result.error }))
  syncButton.disabled = false
  fullSyncButton.disabled = false
  syncButton.textContent = 'Sync latest bookmarks'
  fullSyncButton.textContent = 'Import full library'
}

syncButton.addEventListener('click', () => startSync('SIFTLY_SYNC_NOW'))
fullSyncButton.addEventListener('click', () => startSync('SIFTLY_SYNC_FULL'))
