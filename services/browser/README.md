# Dock streamed browser — run on your Mac

The hub now displays screenshots of a real Chromium process and sends clicks, typing, scrolling, navigation and tab controls over an authenticated WebSocket. Websites are loaded as top-level pages on your Mac, not embedded in frames. Google can therefore display in the app without redirecting your local tab. Some sites can still require a CAPTCHA, reject automated browsers, or disallow certain sign-in flows. This does not bypass those checks. There is no audio/video streaming, file upload/download, clipboard synchronization, drag selection, or password manager in this first version.

## One-time setup

1. Download `mac-server.zip` from the Browser project page and unzip it on your Mac.
2. Install Node.js **22+** from https://nodejs.org/ and Cloudflare's `cloudflared` from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ . If you use Homebrew, Cloudflare documents `brew install cloudflared`.
3. Open Terminal, type `bash ` (including the space), drag `Start-Browser.command` from the extracted folder into Terminal, and press Enter. The launcher installs the locked Node packages and Chromium, generates a private `.env` with a random shared secret, and starts a localhost-only server.
4. Open another Terminal and run `cloudflared tunnel --url http://127.0.0.1:8788`. Copy the HTTPS `trycloudflare.com` URL it prints. It is a temporary endpoint, not a secret. Keep both Terminal windows running.
5. In Cloudflare → Workers & Pages → **chatgpt** → Settings → Variables and Secrets, add:

| Name | Type | Value |
| --- | --- | --- |
| `BROWSER_SERVER_URL` | Text | The HTTPS tunnel origin, with no path (a trailing slash is okay) |
| `BROWSER_SERVER_SECRET` | Secret | The value of the same name from the Mac's `.env` file |

To copy the secret directly to your Mac clipboard without putting it in chat or shell history, run this from the extracted server directory:

```
node --env-file=.env -e 'process.stdout.write(process.env.BROWSER_SERVER_SECRET)' | pbcopy
```

Save/deploy Cloudflare settings. Return to the hub → Browser → Run → **Connect**. No browser server is connected until these settings exist. The secret is sent only between the authenticated Worker and your server, never to page JavaScript.

## Everyday use

Keep your Mac awake and both Terminal windows open. Restart the server with `bash Start-Browser.command`. A Quick Tunnel usually changes its address when restarted; update only `BROWSER_SERVER_URL` in Cloudflare when it does. A named Cloudflare Tunnel can provide a stable address later, with domain setup.

Use the toolbar for Google searches or HTTPS addresses. Tap/click fields on the streamed page, then type with your keyboard. On mobile use the text box below the screen and Send/Enter. Sessions are temporary and separate for each connection; cookies and tabs are deleted on disconnect. Bookmark URLs and the interface theme stay in your local browser. Do not assume that the Mac's existing Chrome cookies or accounts will appear here.

Disconnect closes the session. Idle sessions expire after 15 minutes; every session ends after 30 minutes and must reconnect through owner authentication. Max two sessions and eight tabs each. Closing/sleeping the Mac stops streaming. The Mac hosting this server can observe its remote-browser sessions.

## Security and scope

The listener binds only to `127.0.0.1`. Do not open an inbound router port. Cloudflare Tunnel is the public transport; direct stream upgrades still require a 32+ character shared secret and exact allowed Origin. Worker routes require the existing owner-only Access check (and Turnstile when configured). Browser cookies and login headers are not forwarded to the streaming server.

Chromium runs with its sandbox enabled. All browser network traffic goes through a loopback HTTPS CONNECT proxy: it rejects private/special IP ranges, resolves DNS once and connects to the validated IP to prevent DNS rebinding. QUIC and non-proxied WebRTC UDP are disabled. HTTP/file/data navigation is not accepted. Permissions and downloads are denied; popups are closed. These controls reduce access to your local network but are not a substitute for keeping Chromium/macOS updated. Run under a separate non-administrator Mac user if you need stronger isolation from your own files. This is an early personal-browser prototype, not a hardened multi-user hosting service.

Never commit `.env` or share the secret in chat. Rotate the secret on both sides if exposed. A public `/health` response reveals only whether the server process is online.
