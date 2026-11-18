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

Audio session links are validated independently for playback and storage. Legacy HTTP or protocol-relative links on the fixed allowed hosts are upgraded to HTTPS before use. Session responses may be flat or wrapped in `response`/`payload`. Rejected links return a `GM_AUDIO_<field>_<reason>` diagnostic without disclosing provider URLs, signed query strings, credentials, or response bodies. Storage PUTs and redirects never carry the GroupMe token. A destination error still retains the clip for an explicit retry.

## Pinned conversations
Use Pin in a conversation toolbar (on phones, open ••• and use the pin icon). Pinned groups and DMs stay at the top of their respective conversation lists; unpinned chats keep the server order. The small pin on a chat avatar identifies a pinned conversation. Pins are private Dock preferences, not changes to GroupMe's own chat settings. `dock-groupme-pins-v1` syncs through the existing owner-only project sync. Groups and DM recipients have separate keys; malformed entries are ignored and the list is bounded to 200 pins. Search, drafts, and unread baselines remain independent of pinning.

## Group topics and message grouping
Click a group in the conversation list to expand or collapse its indented `#main` and real GroupMe topics. Choose a child row to open that conversation. Multiple groups can stay expanded. On phones, the current topic button returns to the list and focuses the selected topic. Topic histories, sends, drafts, audio, mentions, and typing use the topic conversation ID; member names and photos come from its parent group. Topic membership and posting rules come from GroupMe. Announcement topics are read-only for ordinary members. The topic list refreshes on selection, manually, and about once per minute while visible. It supports paging beyond 100 topics.

Create and delete go through `/api/groupme/topic-create` and `/api/groupme/topic-delete`. The Worker reads the saved-token account and the live parent-group membership before either mutation, so client-supplied role flags grant no permissions. Deletion verifies the subgroup's parent and cannot target the main chat. The UI requires an explicit deletion confirmation. Failed or ambiguous writes are never retried automatically; uncertain writes require a topic-list refresh before another attempt. API rejection is displayed as an error.

Provider routes: `GET/POST /v3/groups/{parent}/subgroups` and `GET/DELETE /v3/groups/{parent}/subgroups/{topic}`. Reference: https://groupme-js.github.io/GroupMeCommunityDocs/api/groups/subgroups/ . These are community-documented native routes; acceptance with the owner's developer token remains dependent on GroupMe. Tests use simulated responses and do not create or delete real topics.

In the bubble layout, incoming messages use a darker neutral surface and the owner's messages use a lighter gray in dark mode; light mode uses readable neutral equivalents. Consecutive messages from the same sender less than 60 seconds apart share one visible sender header. System notices, sender/name changes, day boundaries, and search results begin separate headers. Grouped bubbles sit 3 pixels apart when idle. On desktop hover or keyboard focus, the message briefly expands downward to make room above it for the action panel; leaving collapses it again. Reduced-motion settings disable the expansion animation. Reply, React, heart, and Delete tools appear on hover or keyboard focus on desktops; a 44-pixel ••• button toggles them on touch devices. Escape or tapping outside closes the touch menu. Each message keeps its own actions and accessible sender/time label.

## Catch up and motion
When a group has unread messages in Dock, opening it keeps a session marker for where new messages begin. Use **Jump to first unread** to return there, even after opening the latest messages clears the count badge. **Load earlier unread** fetches one older page per click when the boundary is outside the loaded history. If older history is unavailable, **Jump to earliest available** goes to the oldest loaded message. Saved last-message IDs sync with existing private read counts; legacy count-only records use the count difference, which may be approximate if GroupMe deletes messages. First visits establish a baseline without an unread marker; DMs and topics without unread counts do not show this control.

Buttons, topic branches, dialogs, new message rows, and context panels have short entrance/interaction animations. Device reduced-motion preferences disable these effects. Pin controls share a rounded outline, and a pinned toolbar icon turns upright with a subtle fill.

Topic rows and the current-topic selector show GroupMe topic photos, with a # fallback and a chat-bubble fallback for #main. Missing or failed images leave the fallback visible. Topic images use the same HTTPS photo loader and private upload-image retry as group photos.

Settings → Animations chooses **Smooth** or **Quick (reduced)** and syncs with existing display preferences. Quick removes entrance animations and shortens transitions to 60 ms. Device reduced-motion preferences disable animation in either mode.

## Shared links and notification privacy
Links opens a searchable, deduplicated list of URLs from loaded messages in the current chat. On phones it is under conversation tools (•••). Earlier history must be loaded before its links appear. URLs open separately; no previews are fetched.

Device notifications → Show chat names and message previews controls alerts on all devices. Turning it off redacts chat names, sender names, and text at the server when queued notifications are retrieved. Already delivered notifications are unchanged; original queued previews remain in private Cloudflare storage until acknowledgment or expiry.

Typing dots and their connection/preview controls have been removed from the running app.

## Sending and background delivery
Settings → Send animation offers Glide, Arc, Spring, Flip, Comet, or Off. Confirmed sent messages fly from the composer to their actual bubble when the returned message is present in refreshed history. No flight is shown for failed sends, Quick mode, or reduced-motion devices. New incoming messages scroll the chat to the bottom automatically, except while filtering message search. Loading earlier history still preserves position.

GroupMe chat watches and Tasks reminder schedules already run in Cloudflare Durable Object alarms without an open Dock page. Enable notifications separately for each device and enable Notify for desired GroupMe chats; Tasks reminders must finish syncing before closing Dock. Force-stopping Chrome, blocked notifications, battery restrictions, expired subscriptions, or no network can delay/prevent delivery. An expired Dock session can produce a generic GroupMe alert. Server restart tests verify both schedulers continue without client polling.
