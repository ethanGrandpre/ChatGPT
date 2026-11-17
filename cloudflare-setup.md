# Current deployment: native Worker Access
The Worker is named `chatgpt`. Enable Worker-level Cloudflare Access using its Access tab. The server reads Cloudflare's trusted `ctx.access.getIdentity()` and requires the configured owner email. No copied team URL, AUD tag, or session secret is needed for this mode. Missing identity or a different email is denied.

Assets are bundled by `scripts/bundle-assets.mjs` and served by the authenticated Worker. Do not add a Wrangler static assets binding: Cloudflare's internal assets router does not propagate ctx.access. Run npm run build before deploying.

Turnstile is optional in native Access mode and is NOT active without its three settings (site key, secret key, session secret). Setting any one without the others keeps access closed. Existing fully configured JWT/Turnstile mode remains supported. The older manual configuration instructions below apply to that mode only.

# Activate the private Dock workspace

The code is ready for Cloudflare Workers + Access + Turnstile. A domain purchase is **not required**. GitHub remains the source repository. The existing public GitHub Pages workflow now publishes only a closed notice.

## 1. Connect this repository to Cloudflare

In [Cloudflare Workers & Pages](https://dash.cloudflare.com/), create a Worker by importing `ethanGrandpre/ChatGPT` from GitHub. Use:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: repository root
- Production branch: `main`

The first deployment deliberately returns **503 — setup incomplete**. It serves no application assets until all of the settings below are present. Worker preview URLs are disabled. Keep `assets.run_worker_first: true`; disabling it would bypass login for static assets.

## 2. Restrict login to your email

In the Worker's settings, enable **Cloudflare Access** for the production `workers.dev` hostname. In Zero Trust / Access, set a self-hosted application for the **entire hostname**, not just the homepage. Use a single **Allow** policy for this exact email:

`ethan.grandpre0360@gmail.com`

Enable **One-time PIN** as the login method. Do not add a bypass or Everyone policy. Copy the application's **AUD tag** and your team's `https://<team>.cloudflareaccess.com` URL.

Add these Worker text variables in Settings → Variables and Secrets:

| Variable | Value |
| --- | --- |
| `ACCESS_TEAM_DOMAIN` | Your full `https://<team>.cloudflareaccess.com` URL |
| `ACCESS_AUD` | The application's AUD tag |
| `OWNER_EMAIL` | `ethan.grandpre0360@gmail.com` (already in the repository config) |

The Worker independently verifies the JWT signature, issuer, audience, expiry, and owner email. A forged identity header or a different signed-in account cannot load assets.

## 3. Enable bot verification

Create a **Turnstile** widget in Cloudflare with the Worker's exact hostname in its hostname allowlist. Choose Managed mode. Add:

| Variable / secret | Type |
| --- | --- |
| `TURNSTILE_SITE_KEY` | Text variable — public site key |
| `TURNSTILE_SECRET_KEY` | Secret — widget secret |
| `SESSION_SECRET` | Secret — at least 32 random characters |

Generate the session secret locally with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`, and paste it directly into Cloudflare's secret field. Never commit it or send it in chat.

The server validates Turnstile through Siteverify and checks the action and hostname. A successful check gives the owner a signed, HttpOnly, Secure cookie for one hour. Every file request still requires the owner Access identity. Verification failure and upstream outages keep access closed. Turnstile reduces automated abuse; it is not a guarantee against every bot.

`keep_vars: true` preserves dashboard-managed variables on subsequent deployments; secrets are retained by Cloudflare.

## 4. Verify before using it

Open the production hostname in a private browser window:

1. Signed out → Cloudflare login; no project files load.
2. Sign in with another email → denied.
3. Sign in with the owner email → complete the bot check → dashboard opens.
4. Open `/projects.json` or a child project directly while signed out → denied.
5. Switch light/dark mode and reload → choice persists.
6. Click **Sign out** → subsequent protected requests require login again.

The old GitHub Pages URL must show only the closed notice. Set GitHub Settings → Pages → Source to **GitHub Actions** to avoid duplicate legacy branch deployments. You can also unpublish GitHub Pages after verifying the closed notice.

## 5. Keep the source private too

The existing GitHub repository is public. Access protects the deployed site, **not** files or commit history available from a public repository. To hide the project source as well, change GitHub repository Settings → General → Danger Zone → Change repository visibility → **Private**. Do not put private project contents into this repository until that is done. This visibility change requires repository administration access, which is not available to the agent in this session.

## Automatic updates

Cloudflare's Git integration rebuilds on pushes to main. The optional `.github/workflows/private.yml` is an alternative: add repository secrets `CLOUDFLARE_API_TOKEN` (Workers Scripts Edit, scoped to your account) and `CLOUDFLARE_ACCOUNT_ID`, then set repository variable `PRIVATE_HOSTING_READY=true`. Use either Cloudflare Git builds or the GitHub workflow to avoid duplicate deployments.

The new hostname uses a separate browser storage area. Persistent project records and preferences now sync through the owner-only Cloudflare Worker when signed in. Existing data remains on its original hostname until you open the updated site there once to upload it; signed-in devices then share the same saved state.

References: [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/) · [Turnstile server verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## GroupMe chat notifications

The GroupMe Messages project uses the existing GROUPME_ACCESS_TOKEN secret. Per-chat Web Push adds a separate GROUPME_PUSH binding and the GroupMePush class with migration tag groupme-push-v1. Deploy with the committed wrangler.jsonc so that this binding and migration are applied. Keep the existing TaskPush binding and migration; its reminders and device subscriptions are independent.

After deployment, open GroupMe Messages → device notification settings. Enable each browser/device, use Send test, then choose Notify on in desired chats. Chat choices apply across all enabled devices. Up to ten chats are checked about every 30 seconds by a server alarm, with backoff on errors. No Mac server or open page is required. The OS/browser must permit Web Push; iPhone/iPad requires Home Screen installation. Push-service acceptance is not a guarantee of immediate OS delivery.

The push contains no message payload. The service worker fetches short previews through the existing owner-only gate and acknowledges them after display. If sign-in expired, it shows a generic alert linking to Dock. Pending previews expire after 24 hours and never enter project-sync. Device IDs also remain device-local.
