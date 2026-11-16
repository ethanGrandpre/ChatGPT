# Streamed Browser
Hub → Browser → Run → Connect. A Chromium process on your Mac streams its screen and receives input through an owner-authenticated Cloudflare WebSocket gateway. No website is embedded in an iframe, and no search-result redirect is needed.

Download mac-server.zip from this project and follow services/browser/README.md. The Mac server, tunnel and two Cloudflare variables must be configured before Connect can work. This repository does not start software on your Mac remotely.

Sessions and cookies are temporary. Bookmarks/theme are browser-local. The service supports search, navigation, tabs, screenshot streaming, mouse clicks, keyboard text and scrolling. Audio, uploads/downloads, clipboard sync and drag selection are not implemented. Sites can still issue CAPTCHA or reject automated browsers.
