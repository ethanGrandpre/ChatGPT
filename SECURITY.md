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
