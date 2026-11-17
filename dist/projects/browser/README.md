# Streamed Browser
Hub → Browser → Run → Connect. A Chromium process on your Mac streams its screen and receives input through an owner-authenticated Cloudflare WebSocket gateway. No website is embedded in an iframe, and no search-result redirect is needed.

Download mac-server.zip from this project and follow services/browser/README.md. The Python server uses pip packages and Chrome already installed on your Mac; no Node.js or Chromium download is required. Keep the Mac server and Cloudflare Tunnel running, and configure the two Cloudflare variables before Connect. This repository does not start software on your Mac remotely.

Sessions and cookies are temporary. Bookmarks/theme sync through the private Dock workspace while signed in. The service supports search, navigation, tabs, screenshot streaming, mouse clicks, keyboard text and scrolling. Audio, uploads/downloads, clipboard sync and drag selection are not implemented. Sites can still issue CAPTCHA or reject automated browsers.
