# GroupMe Messages

Rebuilt client and owner-only Worker gateway. Configure GROUPME_ACCESS_TOKEN as a Cloudflare Worker secret. No OAuth callback flow is required. Never put the token in source, browser storage, or chat.

The app checks /api/groupme/status first (GroupMe /v3/users/me), then lists groups or existing DM chats. Groups use /v3/groups and group messages; DMs use /v3/chats, /v3/direct_messages?other_user_id=..., and read-only history. DM sending is blocked locally with DM_READ_ONLY because GroupMe rejects this operation through the Developer API. Backend release must be groupme-dms-readonly-1. Requests go only to https://api.groupme.com using X-Access-Token. Redirects are not followed. Tokens and raw exceptions are not returned in errors. Sending is explicit, uses a source GUID, and is never automatically retried.

The previous GroupMe ID is retired so this project can appear even when the old entry was hidden from Dock. Legacy URLs contain moved notices. User settings and the saved Worker secret are preserved.

Validation: groupme.test.mjs covers request validation and errors; groupme-ui.test.mjs exercises account checks, rendering, refresh, and deployment mismatch handling; groupme-runtime.test.mjs runs the real Worker handler in workerd with simulated upstream responses, including owner rejection and group and DM list/history/send paths. No test sends real messages. Live account access depends on the deployed Worker, token, and GroupMe availability.

## Automatic updates
The active conversation polls every 5 seconds and the visible conversation list every 30 seconds. Hidden/offline pages pause; visibility and network recovery resume checks. Sending and manual history reads prevent overlapping polls. Failures use exponential backoff capped at 60 seconds; HTTP 429 enforces at least 60 seconds of cooldown. Polling merges history and preserves drafts and reading position. This is near-live polling while the app is open, not a WebSocket or device push notification service.
