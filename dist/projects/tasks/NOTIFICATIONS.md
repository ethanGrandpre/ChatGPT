# Tasks device notifications

## Enable on your Android phone or desktop
Open Tasks → Run → **Enable notifications** and allow the browser's notification prompt. Click **Send test**, then check your actual device notification tray. In a task's Edit dialog, choose **Remind me**, a future date/time, and Save. A due date alone does not create a timed reminder. The reminders panel reports how many are synced to this device.

Notifications use Web Push and a Cloudflare Durable Object alarm, so the Tasks tab does not have to stay open. You do not need your Mac browser server for task reminders. Each device must enable notifications separately. On iPhone/iPad, use a supported OS/browser and add Tasks to the Home Screen before enabling. Android Chrome can receive them through the device notification system. Browser permission, OS notification/battery/network settings, private/incognito mode, device availability, browser support and push-service availability affect delivery and timing. This is not a guaranteed alarm clock.

Push messages intentionally contain no task titles or notes. The generic notification says a Tasks reminder is due. Clicking it opens the private Tasks app and may require signing in again. Task records remain browser-local; only reminder IDs/timestamps, a device ID and the push endpoint are stored on the server. This is notification scheduling, not task synchronization across devices. To see the same tasks on another device, export/import tasks, then enable reminders on that device.

Complete/delete a task, remove its reminder, or disable notifications to cancel its device's server schedule. These changes must sync while online; if a cancellation cannot sync, the previous scheduled notification may still arrive. Disable on each device separately. Re-enabling preserves the browser's permission setting. Permission can also be revoked in browser/OS settings. Expired subscriptions are removed after a push service rejects them. Sending to a push service is not proof that the device displayed the message.

## Server implementation
`TaskPush` is a SQLite-backed Durable Object, configured in wrangler.jsonc. Cloudflare's Git deployment creates its binding/migration. It generates and stores its VAPID keypair inside Durable Object storage; there are no API keys or private VAPID keys to paste into the browser or commit to Git. The gateway is protected by the existing owner-only Access check, and same-origin JSON is required for mutations. The service worker has no fetch handler and does not cache or bypass the hub login.

The scheduler sends standard payload-free Web Push POSTs with ES256 VAPID authentication (RFC 8292). The browser's push endpoint is restricted to known browser push services. Signed tokens are reused for six hours and expire within twelve. At most twelve devices and five hundred reminders per device are stored; each device is a separate storage record. One push aggregates simultaneously due reminders, with a stable notification tag. Transient errors retry up to three attempts; permanent 404/410 endpoints are removed. Alarms are at-least-once; the server records accepted attempts to avoid repeat scheduling, but crashes or delayed providers may still cause duplicates. Generic notification tagging coalesces them.

Cloudflare storage/alarms and browser push quotas apply. If deployment cannot create the Durable Object namespace, the UI reports that notification storage is not configured. Do not work around an error by granting public access to the API.

Tests cover signatures, scheduling/deduplication, cancellations, retry/expiration and authentication. Automated browser tests mock notification permission and push subscription; actual phone delivery must be checked with **Send test** on your device.
