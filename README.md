# Dock
A minimal black/white project hub. GitHub stores the source; Cloudflare Workers + Access protect the private site. The previous public Pages address now serves a closed notice.

## Run locally

`npm ci`, then `npm run dev` at http://localhost:3000. This local server is for development and does not provide authentication. `npm test` checks the production authentication boundary. `npm run check:worker` validates the deployment bundle without publishing.

## Private hosting

Follow [cloudflare-setup.md](cloudflare-setup.md) to connect the existing Cloudflare account, restrict login to the owner email, and enable server-verified Turnstile bot checks. No custom domain is required. The Worker denies access until configuration is complete. The repository must also be made private if the source should be hidden.

## Projects

Add a child folder under `projects/`, optionally with a `project.json` containing name, description, collection, or a deployed URL. `npm run build` discovers folders and builds the hub. Every Cloudflare Git build includes new projects automatically. An `index.html` opens directly; other folders get a file detail page. Framework projects need compiled static output or separate hosting.

The dashboard supports add/edit/remove links, collections, search, favorites, drag ordering, keyboard-accessible move-to-top, saved light/dark mode, and JSON backup/restore. UI settings are saved in this browser; they are not synchronized between devices. External linked apps require their own protection.
