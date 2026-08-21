# Siftly Bookmark Sync extension

This unpacked Chrome extension syncs new X bookmarks to the public Siftly deployment without exposing write access to site visitors.

- It syncs only the newest X bookmark page automatically, at most once every 24 hours, even if Chrome is restarted.
- Installing or reloading it never opens X or starts a sync immediately.
- The popup's **Sync latest bookmarks** button remains available for an immediate manual refresh.
- **Import full library** deliberately walks up to 30 X bookmark pages (up to about 3,000 bookmarks) for the one-time historical backfill.
- It can use an existing X bookmarks tab or briefly open an inactive one and close it after syncing.
- Bookmarks created on another device are picked up the next time this Chrome profile runs while signed into X.
- The private token lives in `config.local.js`, which is intentionally ignored by Git.

Copy `config.local.example.js` to `config.local.js`, set the same value as the Vercel `BOOKMARK_SYNC_TOKEN`, then load this directory from `chrome://extensions` with Developer mode enabled.
