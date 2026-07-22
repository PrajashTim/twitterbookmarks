const statusElement = document.querySelector('#status')
const detailsElement = document.querySelector('#details')
const syncButton = document.querySelector('#sync')

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
syncButton.addEventListener('click', async () => {
  syncButton.disabled = true
  syncButton.textContent = 'Syncing...'
  statusElement.textContent = 'Syncing with X...'
  const result = await chrome.runtime.sendMessage({ type: 'SIFTLY_SYNC_NOW' })
  const { siftlyStatus } = await chrome.storage.local.get('siftlyStatus')
  render(siftlyStatus ?? (result.ok ? { status: 'success', ...result } : { status: 'error', error: result.error }))
  syncButton.disabled = false
  syncButton.textContent = 'Sync now'
})
