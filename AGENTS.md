# Current deployment: native Worker Access
The Worker is named `chatgpt`. Enable Worker-level Cloudflare Access using its Access tab. The server reads Cloudflare's trusted `ctx.access.getIdentity()` and requires the configured owner email. No copied team URL, AUD tag, or session secret is needed for this mode. Missing identity or a different email is denied.

Assets are bundled by `scripts/bundle-assets.mjs` and served by the authenticated Worker. Do not add a Wrangler static assets binding: Cloudflare's internal assets router does not propagate ctx.access. Run npm run build before deploying.

Turnstile is optional in native Access mode and is NOT active without its three settings (site key, secret key, session secret). Setting any one without the others keeps access closed. Existing fully configured JWT/Turnstile mode remains supported. The older manual configuration instructions below apply to that mode only.

# Adding projects to Dock
Create every new child project in `projects/<unique-slug>/`. Never maintain a manual project list. `npm run build` discovers all direct child directories and copies their assets into the hub.
Use an optional `project.json` with name, description, collection, status (In progress / Planning / Complete), color (sage / peach / lavender / blue / sand / rose), icon, and url. A project with index.html opens directly; otherwise the hub generates a folder detail view. For framework apps, build their browser output into the child directory or set url to their deployed URL; do not copy node_modules or secrets into projects/.
Run npm run build after adding or changing projects, then publish the new build. The development server discovers changes on the next poll (15 seconds). Browser-created links and customization are stored on that browser, not written to repository files. Never overwrite user settings to add a project.

# Private hosting
Production uses the Cloudflare Worker in `worker/`, with owner-only Access and server-side Turnstile verification. Read SECURITY.md and cloudflare-setup.md before deployment changes. Never publish dist/ to GitHub Pages: that workflow must publish only public-closed/. Keep root .nojekyll absent so legacy Jekyll builds honor _config.yml source exclusions. Never add a client-side password gate as a substitute for server authentication. Never disable assets.run_worker_first. Keep secrets outside Git.

# Project launch convention
Each new project opens its details page at projects/<slug>/index.html. Include a visible Run button linking to a separate run.html (or the actual app entrypoint). Running a project replaces the hub page with the project's own interface; do not render the hub around the running application. Describe browser/platform restrictions accurately.

# Streamed Browser project
The Browser Run page uses projects/browser/stream.js and an authenticated /_browser Worker gateway. Mac server source is services/browser/server.py; its downloadable zip uses pip packages and the Chrome already installed on the Mac, without Node.js or a Chromium download. npm run build packages the server without .venv or .env. Read services/browser/README.md before changes. Do not weaken owner checks, expose secrets to JavaScript, disable the Chromium sandbox, or remove the public-IP egress restrictions. Browsing requires the user's Mac process and Cloudflare Tunnel; never report it live solely because the hub deploy succeeded.

# Shared appearance
Every hub and child HTML page loads the shared `appearance.js` (blocking in the head, after charset/viewport) and `appearance.css`, using a correct relative path to the root. These initialize the saved light/dark/system mode, accent and canvas tone before rendering. Use `DockAppearance.toggleTheme()` for theme buttons, and preserve other `dock-v1` settings when updating a preference. Never create another independent theme store. New projects may use `project-kit.js` for standard theme button wiring.
