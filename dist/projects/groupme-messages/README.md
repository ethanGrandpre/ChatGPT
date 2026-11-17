# GroupMe Messages

Rebuilt client and owner-only Worker gateway. Configure GROUPME_ACCESS_TOKEN as a Cloudflare Worker secret. No OAuth callback flow is required. Never put the token in source, browser storage, or chat.

The app checks /api/groupme/status first (GroupMe /v3/users/me), then lists groups or existing DM chats. Groups use /v3/groups and group messages; DMs use /v3/chats, /v3/direct_messages?other_user_id=..., and read-only history. DM sending is blocked locally with DM_READ_ONLY because GroupMe rejects this operation through the Developer API. Backend release must be groupme-dms-readonly-1. Requests go only to https://api.groupme.com using X-Access-Token. Redirects are not followed. Tokens and raw exceptions are not returned in errors. Sending is explicit, uses a source GUID, and is never automatically retried.

The previous GroupMe ID is retired so this project can appear even when the old entry was hidden from Dock. Legacy URLs contain moved notices. User settings and the saved Worker secret are preserved.

Validation: groupme.test.mjs covers request validation and errors; groupme-ui.test.mjs exercises account checks, rendering, refresh, and deployment mismatch handling; groupme-runtime.test.mjs runs the real Worker handler in workerd with simulated upstream responses, including owner rejection and group and DM list/history/send paths. No test sends real messages. Live account access depends on the deployed Worker, token, and GroupMe availability.

## Automatic updates
The active conversation polls every 5 seconds and the visible conversation list every 30 seconds. Hidden/offline pages pause; visibility and network recovery resume checks. Sending and manual history reads prevent overlapping polls. Failures use exponential backoff capped at 60 seconds; HTTP 429 enforces at least 60 seconds of cooldown. Polling merges history and preserves drafts and reading position. This is near-live polling while the app is open, not a WebSocket or device push notification service.

## Group message actions
Heart reactions use POST /v3/messages/:group/:message/like and unlike (also present in the public Groupy client). Replies are explicitly quoted text, not native threaded replies. Delete uses DELETE /v3/conversations/:group/messages/:message (corroborated in public GroupMe clients), with explicit confirmation. The server reads the account and latest 100 group messages to verify author ownership before deleting. Older or unverifiable messages are denied locally. GroupMe can reject these actions and the client reports that response without pretending success. Native editing is not implemented because a supported Developer API endpoint could not be verified. No live messages were changed during testing.

## Text display
The header slider adjusts message and composer text from 12px to 24px. Its dock-groupme-text-size-v1 preference uses private project sync. Emoji-only messages are displayed at 2.3 times the selected size; Unicode compound emoji, flags, skin tones, and keycaps are recognized, while ordinary text, punctuation, and plain numbers keep the selected size.

## Reaction confirmation
Like/unlike requests use an empty POST body. After acknowledgement, the Worker reads the GroupMe account and latest 100 group messages, and confirms that the message favorited_by list matches the requested state. The client uses only this returned server state, never adds local-only favorites. If read-back fails or the state has not propagated, REACTION_UNCONFIRMED is reported. Older messages outside that window cannot be verified this way. Arbitrary emoji reaction routes could not be verified; this integration exposes only heart likes.
