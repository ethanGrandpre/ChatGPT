# Tasks

A standalone local-first task list. Hub → Tasks → Run. Supports quick add, edit notes, priorities, due dates, status changes, completion, search, due/active/done filters, sorting, deletion/clear with Undo, backup export/import and light/dark mode.

Tasks save in localStorage under dock-tasks-v1. Data is local to this origin/device, not cloud-synced. Export before clearing browser data. Import merges previously unseen task IDs and preserves existing records; it never overwrites a task with the same ID. There are no provider accounts, paid services or downloads required to use the app. The existing Cloudflare owner login still protects the web app.

## Notifications
Device notifications are opt-in. Use Enable notifications, then Send test and check the OS notification tray. Set a task's Remind me date/time to schedule a push. Reminders are server-scheduled even while the Tasks tab is closed; cancellations need an internet connection to sync. Delivery is subject to browser/OS/network settings. Read NOTIFICATIONS.md for privacy, platform limitations and server details.
