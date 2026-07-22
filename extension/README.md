# Siftly Bookmark Sync extension

This unpacked Chrome extension syncs new X bookmarks to the public Siftly deployment without exposing write access to site visitors.

- It syncs automatically at most once every 24 hours, even if Chrome is restarted.
- The popup's **Sync now** button remains available for an immediate manual refresh.
- It can use an existing X bookmarks tab or briefly open an inactive one and close it after syncing.
- Bookmarks created on another device are picked up the next time this Chrome profile runs while signed into X.
- The private token lives in `config.local.js`, which is intentionally ignored by Git.

Copy `config.local.example.js` to `config.local.js`, set the same value as the Vercel `BOOKMARK_SYNC_TOKEN`, then load this directory from `chrome://extensions` with Developer mode enabled.
