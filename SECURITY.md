# Current deployment: native Worker Access
The Worker is named `chatgpt`. Enable Worker-level Cloudflare Access using its Access tab. The server reads Cloudflare's trusted `ctx.access.getIdentity()` and requires the configured owner email. No copied team URL, AUD tag, or session secret is needed for this mode. Missing identity or a different email is denied.

Assets are bundled by `scripts/bundle-assets.mjs` and served by the authenticated Worker. Do not add a Wrangler static assets binding: Cloudflare's internal assets router does not propagate ctx.access. Run npm run build before deploying.

Turnstile is optional in native Access mode and is NOT active without its three settings (site key, secret key, session secret). Setting any one without the others keeps access closed. Existing fully configured JWT/Turnstile mode remains supported. The older manual configuration instructions below apply to that mode only.

# Security boundaries

- GitHub Pages publishes `public-closed/` only, with no dashboard or child assets. Legacy Jekyll publishing excludes source/build folders through `_config.yml`; never restore root `.nojekyll` while using branch publishing.
- The private app is built into `dist/` and served exclusively through the Cloudflare Worker. `assets.run_worker_first` must remain true. Production login must cover the entire hostname. Preview URLs are disabled.
- Authentication uses Cloudflare Access RS256 JWTs verified by `jose` against that team's JWKS. The exact owner email is required; email headers alone are never trusted.
- Turnstile is verified server-side. A signed verification cookie is bound to the identity and origin, expires after an hour, and does not replace Access authentication.
- Missing configuration, invalid identity, failed verification, and verification-service outages deny protected assets. Private responses are not cacheable.
- Only static child projects are served. External project URLs have their own access rules; linking to a third-party URL does not make that third-party app private.
- Source privacy requires a private repository. A public Git repository, old deployments, downloaded artifacts, and repository history are outside the Worker's protection. Never commit secrets.
- Browser localStorage is not account synchronization or a secret store. UI settings backups contain project URLs and preferences and must be handled accordingly.

Run `npm test` for authentication and bot-verification boundary checks. Read `cloudflare-setup.md` before enabling private hosting.

## Streamed browser
The /_browser gateway runs after the owner check and any configured Turnstile check. WebSocket upgrades require the hub's exact Origin and a fixed HTTPS upstream configured by the administrator. The upstream receives only its dedicated shared secret, not Access JWTs, browser cookies, or client Authorization headers. The Mac service rejects unauthenticated upgrades before launching Chromium. It uses temporary contexts, browser sandboxing, a public-IP-only CONNECT proxy, blocked permissions/downloads/popups, input limits and session expiry. Its Mac launcher and hosting requirements are documented in services/browser/README.md. Do not expose the browser service or Chrome DevTools without authentication. No remote server credentials belong in client-side files or Git.

## Tasks push reminders
The authenticated `/api/tasks-push` gateway requires the existing owner identity; mutation requests must be same-origin JSON. `TaskPush` uses a SQLite Durable Object and alarms. VAPID private keys are generated and kept in server storage, never browser JavaScript or Git. Only device identifiers, browser push endpoints, reminder IDs/times, optional repeat rules/time zones and delivery bookkeeping leave the device; task titles and notes remain browser-local. Push destinations are restricted to known HTTPS browser push providers with redirects disabled. The service worker receives payload-free pushes and reads task names/due dates from a device-local IndexedDB mirror to display detailed reminders, with a generic fallback. Task content is not sent to the server or push provider. It has no fetch/offline asset cache handler. Browser and OS notification permissions are required. Push acceptance does not prove display on the device. See `projects/tasks/NOTIFICATIONS.md` for setup, retention and delivery limits.
