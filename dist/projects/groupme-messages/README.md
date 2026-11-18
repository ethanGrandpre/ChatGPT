# GroupMe Messages

Rebuilt client and owner-only Worker gateway. Configure GROUPME_ACCESS_TOKEN as a Cloudflare Worker secret. No OAuth callback flow is required. Never put the token in source, browser storage, or chat.

The app checks /api/groupme/status first (GroupMe /v3/users/me), then lists groups or existing DM chats. Groups use /v3/groups and group messages; DMs use /v3/chats, /v3/direct_messages?other_user_id=..., and read-only history. DM sending is blocked locally with DM_READ_ONLY because GroupMe rejects this operation through the Developer API. Backend release must be groupme-notify-emoji-1. Core account and conversation requests go to https://api.groupme.com using X-Access-Token. Media and typing use their separately restricted GroupMe gateways. Redirects are not followed. Tokens and raw exceptions are not returned in errors. Sending is explicit, uses a source GUID, and is never automatically retried.

The previous GroupMe ID is retired so this project can appear even when the old entry was hidden from Dock. Legacy URLs contain moved notices. User settings and the saved Worker secret are preserved.

Validation: groupme.test.mjs covers request validation and errors; groupme-ui.test.mjs exercises account checks, rendering, refresh, and deployment mismatch handling; groupme-runtime.test.mjs runs the real Worker handler in workerd with simulated upstream responses, including owner rejection, group sends, and read-only DM list/history paths. No test sends real messages. Live account access depends on the deployed Worker, token, and GroupMe availability.

## Automatic updates
The active conversation and visible conversation list check every 5 seconds by default. Settings accepts a whole-number interval from 1 to 300 seconds. Hidden/offline pages pause; visibility and network recovery resume checks. Sending and manual history reads prevent overlapping polls. Failures use exponential backoff capped at 300 seconds; HTTP 429 enforces at least 60 seconds of cooldown. Polling merges history and preserves drafts and reading position. This is near-live polling while the app is open. Per-chat push alerts use the separate server alarm service described below.

## Group message actions
Heart reactions use POST /v3/messages/:group/:message/like and unlike (also present in the public Groupy client). Replies are explicitly quoted text, not native threaded replies. Delete uses DELETE /v3/conversations/:group/messages/:message (corroborated in public GroupMe clients), with explicit confirmation. The server reads the account and latest 100 group messages to verify author ownership before deleting. Older or unverifiable messages are denied locally. GroupMe can reject these actions and the client reports that response without pretending success. Native editing is not implemented because a supported Developer API endpoint could not be verified. No live messages were changed during testing.

## Text display
The Settings text-size slider adjusts message and composer text from 12px to 24px. Its dock-groupme-text-size-v1 preference uses private project sync. Emoji-only messages are displayed at 2.3 times the selected size; Unicode compound emoji, flags, skin tones, and keycaps are recognized, while ordinary text, punctuation, and plain numbers keep the selected size.

## Reaction confirmation
The picker supports ❤️ 👍 🤣 🎉 🔥 😮 👀 😭 🥺 🙏 💀 🫶 🤬 💅 🫠. POST /v3/messages/:group/:message/like carries `{like_icon:{type:'unicode',code:emoji}}`; unlike removes the current reaction. Source: https://github.com/groupme-js/GroupMeCommunityDocs/blob/b335ec5a6728936ab89a1083f67c75745f4848b5/docs/api/conversations/reactions.md. These are community documents, so live Developer API acceptance still needs verification. Arbitrary emoji beyond those 15 are explicitly rejected in those docs. Each user has one reaction per message, replaced by a new selection.

The Worker checks the returned reaction acknowledgement and/or saved message state before confirming. Heart likes can use favorited_by readback; non-heart emoji require a matching server emoji acknowledgement. The client never reports a local-only selection as success. GroupMe may restrict the route for developer tokens, which is reported as an error. No credentials or full raw errors are returned.

## Phone layout
At 650px and below, the app uses a conversation list and a separate full-height chat view. Chats returns to the list without clearing the active draft; selecting that same conversation resumes it. The visual viewport drives available height while the keyboard is open. Touch targets, safe areas, wrapping metadata, and compact landscape/keyboard layouts keep controls usable. Desktop retains both panels.

## Per-chat device push
Enable each browser/device in notification settings, then use Notify on/off in a group or DM. Chat choices apply to all enabled devices. The GROUPME_PUSH Durable Object is separate from TaskPush, uses its own VAPID keys and subscriptions, and polls at most ten watched chats about every 30 seconds. It seeds message cursors, skips own/old messages, deduplicates each new message, and backs off on failures. No open page or Mac server is required. The migration and binding are in wrangler.jsonc. Existing Tasks schedules and subscriptions are unchanged.

Push requests contain no message payload. The GroupMe service worker fetches short previews from an owner-authenticated endpoint; after displaying them it acknowledges them. Expired sign-in shows a generic alert instead. Previews are bounded to 30 per device and expire after 24 hours; they are private Cloudflare storage, not end-to-end encrypted. Device IDs are excluded from project sync. Expired push endpoints are removed. Web Push depends on browser/OS delivery and permission; iPhone/iPad requires Home Screen installation. Send test verifies acceptance by the device push service, not guaranteed OS display.

## Media and drafting
Use + to choose one photo (JPG, PNG, GIF, or WebP, up to 8 MB). Pasted images and a single dropped photo use the same upload path. Uploading prepares an attachment; Send is always explicit. A failed replacement preserves the preceding attachment. Shared images open in an in-page preview, with an original-image link and normal modified-click behavior. Modern authenticated GroupMe image URLs retry through the owner-only image proxy.

Voice clips can be recorded for up to 60 seconds or selected from an audio file, with an 8 MB limit. Recordings stop their microphone tracks when closed, including late permission responses. Clips remain in the dialog after a failed upload for an explicit retry. Native MediaRecorder support, microphone permission, and GroupMe upload availability are required.

Text, mentions, quoted replies, and prepared attachments are saved separately per group in sessionStorage for up to 24 hours (30 drafts maximum). These temporary drafts stay in this browser tab and are not synced across devices. Display preferences and unread baselines use the private project sync. A browser-reported offline send makes no network request and retains the draft; reconnecting resumes reads without automatically resending.

Unchanged message/media nodes remain mounted during polling. Updates wait while text is selected, message controls are focused, a dialog is open, or media is playing/paused partway through. Jump to latest applies pending changes. Manual Refresh merges loaded history. Message anchors protect reading position when earlier content or media changes. Search highlights literal matches in the loaded messages and sender names.

Browser coverage includes mobile/desktop composer alignment, large text, image previews, literal search highlighting, selection preservation, mounted-row reuse, paste/drop, offline recovery, and simulated microphone capture/upload. The audio UI regression tests cover closed/reopened permission races and retained failed uploads. These checks use simulated upstream responses and send no real GroupMe messages.
