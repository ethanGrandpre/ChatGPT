# Video Call

A browser-only, two-person WebRTC call. Create a room, copy the invite, and have both people open it and select Join room. Camera/microphone are requested only on Join. Uncheck either before joining for audio-only/video-only; with both off you can listen/watch without capture. A track omitted at join cannot be enabled mid-call: leave/rejoin to add it. In-call toggles mute existing tracks. Leave/page exit stops local tracks and releases the room slot. A third participant is rejected. No recording, chat transcript, contacts, or owner project data is shared.

## Access

Production uses native Worker Cloudflare Access identity. Every identity that the existing Cloudflare Access application admits may use `/projects/video-call/*`, `/api/video-call`, and a small allowlist of common static assets. Other project pages and all existing data APIs remain owner-only. This is an intentional, narrow exception to Dock's owner gate. Calls are not anonymous/public. Share the full room link privately; its random 32-character room fragment is the room invitation. Rooms hold up to two participant sessions (including two tabs under one account).

Cloudflare's edge login policy runs before this code. If it currently permits only the owner email, add the other person's email to the existing Access Allow policy using an Emails rule, then save. Do not add an Everyone/Bypass rule or remove login. The other person can open the direct call invite; they do not need access to the owner's hub. Legacy JWT mode remains owner-only. No application code can bypass a Cloudflare Access policy that denies the guest.

## Deployment

`wrangler.jsonc` adds the `VIDEO_ROOMS` SQLite Durable Object and migration `video-call-v1`. Normal `npm run build`/`wrangler deploy` applies it. Do not add a static assets binding. Signaling JSON uses authenticated, same-origin POST requests, identity-bound random peer IDs, bounded queues/cursors and payloads, and 45-second participant expiry. Room signaling state (including temporary SDP/ICE addresses) is deleted by an alarm after a minute without activity; media flows through WebRTC, never through this room service. The shared-call page explicitly disables owner project synchronization; ephemeral call state is not a project record.

## Relay / network reliability

Default: public Cloudflare STUN, direct peer connections. This works on many networks but cannot guarantee connectivity across strict NAT/firewalls. No Mac server is needed. For reliable cross-network calls, create a Cloudflare Realtime TURN key in the Cloudflare dashboard and configure the Worker:

- `VIDEO_TURN_KEY_ID`: TURN key identifier (Worker variable).
- `VIDEO_TURN_API_TOKEN`: TURN API bearer token (Worker secret, never Git/browser code).

The server requests one-hour ICE credentials from the fixed Cloudflare TURN endpoint and sends only the short-lived credentials to signed-in call participants. TURN service charges/limits are separate; do not promise unlimited/free relaying. Without both settings the UI reports direct mode and gives a useful failure message. With invalid settings the Join flow reports a relay error before asking for camera access.

## Verification

`tests/video-call.test.mjs`: room capacity, identity binding, queue replay/acknowledgement, cleanup, guest-only call scope, unauthenticated/cross-origin rejection, relay token isolation.

`tests/browser/video-call.mjs`: real Chromium WebRTC offer/answer exchange and capture between separate owner and friend identities using fake capture devices, real local workerd Durable Object signaling, third-person rejection, mute/camera toggles, track cleanup, leave/rejoin, owner-data isolation, and desktop/mobile layouts. Tests remote media transport with local ICE where permitted. The managed Chromium environment here sets WebRtcIPHandling to disable_non_proxied_udp, so remote transport checks are explicitly skipped without a TURN relay. It does not prove public internet/TURN or real-device camera compatibility.
