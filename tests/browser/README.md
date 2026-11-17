# GroupMe browser regression check

`groupme-mobile.mjs` serves the current project sources on a temporary loopback port and uses a real Chromium renderer plus the Worker in Miniflare. GroupMe traffic is simulated; no account credentials are used. All non-local browser requests are blocked.

Install/provide Playwright, then run from the repository root:

    node tests/browser/groupme-mobile.mjs

Optional environment variables:

- `DOCK_PLAYWRIGHT_MODULE`: path to an existing Playwright ES module.
- `DOCK_CHROMIUM_PATH`: installed Chromium executable (default `/usr/bin/chromium`).
- `DOCK_TEST_NO_SANDBOX=1`: only for an already isolated test container that cannot launch Chromium’s sandbox. This changes the fixture browser only, never the streamed Browser project or production.

Checks cover local typing, animation styles, incoming serialized typing events through the Worker gateway, expiry, duplicate connection prevention, authenticated personal and group subscriptions, the preview button, mobile reading space, a keyboard-sized viewport, desktop, and page errors. Screenshots are written to ignored `work/` files. This test does not establish that GroupMe is emitting events for a particular live account.
