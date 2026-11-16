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
