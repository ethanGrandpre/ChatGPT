# Tasks

A standalone local-first task list. Hub → Tasks → Run. Supports quick add, edit notes, priorities, due dates, status changes, completion, search, due/active/done filters, sorting, deletion/clear with Undo, backup export/import and light/dark mode.

Tasks save in localStorage under dock-tasks-v1. Data syncs to your private Dock workspace while signed in. Export before clearing browser data; backups are also useful if you need an offline copy. Import merges previously unseen task IDs and preserves existing records; it never overwrites a task with the same ID. There are no provider accounts, paid services or downloads required to use the app. The existing Cloudflare owner login still protects the web app.

## Notifications
Device notifications are opt-in. Use Enable notifications, then Test notification and check the OS notification tray. Set a task's Remind me date/time to schedule a push. Reminders are server-scheduled even while the Tasks tab is closed; cancellations need an internet connection to sync. Delivery is subject to browser/OS/network settings. Read NOTIFICATIONS.md for privacy, platform limitations and server details.

Reminder notifications show the task name and optional due date using a local IndexedDB mirror, including when Tasks is closed. The notification scheduler receives reminder IDs/times and device subscription details. Separately, the private Dock sync service stores the full Tasks project data, including titles, due dates and notes, so it can sync across your signed-in devices. Cloudflare Access protects that data, but it is not end-to-end encrypted. Refresh Tasks once after deployment to update the background worker.

## Task organization and safety
- Today includes overdue tasks; Upcoming covers the next seven local calendar days. Counts follow the selected task list. Completed tasks appear after active ones. Search includes titles, notes and list names.
- Add details creates a task with status, priority, list, due date, reminder and notes in one step. List names are created by assigning a task; Inbox is the default. Date/reminder shortcuts use this device's calendar and time zone.
- `/` or Ctrl/⌘ K focuses search, N focuses quick entry, Escape clears search, and Ctrl/⌘ Enter saves the open task editor. Views, sorting and list selection sync through the private workspace.
- Tasks and saved views sync through the private Dock workspace while signed in. Changes reach other open devices within seconds; reload the project if a new-data badge appears. Sync merges records by task ID when first enabled. This single-owner workspace sync is not a transactional multi-user database.
- The open editor draft is saved in sessionStorage for refresh recovery in that tab. Explicit Cancel/close/Escape discards it. A failed storage write rolls back the change, leaves editor/quick-entry text available and shows an error. Export a backup before clearing browser data.

## Recurring reminders
In the task editor, set Remind me and choose Repeat reminder: Every day, Weekdays, Every week, or Every month. The start time anchors the schedule in its saved IANA time zone. Cloudflare advances the schedule while Tasks is closed; the push message still gets task names/due dates from the device-local mirror; the separate project sync stores the full task record in your private workspace. Complete/delete the task or disable notifications to stop it once the change syncs. Reopening a task resumes future occurrences. This repeats the reminder for the same task; it does not generate new tasks or roll the task's due date forward.

Daily/weekly reminders keep their local wall-clock time through daylight-saving changes. A nonexistent spring-forward time moves ahead by the gap; an ambiguous fall-back time uses the earlier occurrence once. Monthly schedules clamp a missing day to that month's last day, preserving the original day for later months (Jan 31 → Feb 28 → Mar 31). Missed occurrences are coalesced rather than replayed as a backlog. Browser/OS delivery limits still apply. The editor shows the next planned occurrence and its time zone.
