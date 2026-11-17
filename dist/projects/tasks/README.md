# Tasks

A standalone local-first task list. Hub → Tasks → Run. Supports quick add, edit notes, priorities, due dates, status changes, completion, search, due/active/done filters, sorting, deletion/clear with Undo, backup export/import and light/dark mode.

Tasks save in localStorage under dock-tasks-v1. Data is local to this origin/device, not cloud-synced. Export before clearing browser data. Import merges previously unseen task IDs and preserves existing records; it never overwrites a task with the same ID. There are no provider accounts, paid services or downloads required to use the app. The existing Cloudflare owner login still protects the web app.

## Notifications
Device notifications are opt-in. Use Enable notifications, then Test notification and check the OS notification tray. Set a task's Remind me date/time to schedule a push. Reminders are server-scheduled even while the Tasks tab is closed; cancellations need an internet connection to sync. Delivery is subject to browser/OS/network settings. Read NOTIFICATIONS.md for privacy, platform limitations and server details.

Reminder notifications show the task name and optional due date using a local IndexedDB mirror, including when Tasks is closed. Only reminder IDs/times travel to the server; titles and dates remain on the device. Refresh Tasks once after deployment to update the background worker.

## Task organization and safety
- Today includes overdue tasks; Upcoming covers the next seven local calendar days. Counts follow the selected task list. Completed tasks appear after active ones. Search includes titles, notes and list names.
- Add details creates a task with status, priority, list, due date, reminder and notes in one step. List names are created by assigning a task; Inbox is the default. Date/reminder shortcuts use this device's calendar and time zone.
- `/` or Ctrl/⌘ K focuses search, N focuses quick entry, Escape clears search, and Ctrl/⌘ Enter saves the open task editor. Views/sorting/list selection are remembered in this browser.
- Edits merge independent changes from other tabs. Conflicting edits to one task require review or saving a copy. This is browser-local coordination, not cross-device cloud sync or a transactional multi-user database.
- The open editor draft is saved in sessionStorage for refresh recovery in that tab. Explicit Cancel/close/Escape discards it. A failed storage write rolls back the change, leaves editor/quick-entry text available and shows an error. Export a backup before clearing browser data.
