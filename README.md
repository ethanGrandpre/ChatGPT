# Dock
A minimal black/white project hub. GitHub stores the source; Cloudflare Workers + Access protect the private site. The previous public Pages address now serves a closed notice.

## Run locally

`npm ci`, then `npm run dev` at http://localhost:3000. This local server is for development and does not provide authentication or private cloud sync; project data remains in local browser storage there. `npm test` checks the production authentication boundary. `npm run check:worker` validates the deployment bundle without publishing.

## Private hosting

Follow [cloudflare-setup.md](cloudflare-setup.md) to connect the existing Cloudflare account, restrict login to the owner email, and enable server-verified Turnstile bot checks. No custom domain is required. The Worker denies access until configuration is complete. The repository must also be made private if the source should be hidden.

## Projects

Add a child folder under `projects/`, optionally with a `project.json` containing name, description, collection, or a deployed URL. `npm run build` discovers folders and builds the hub. Every Cloudflare Git build includes new projects automatically. An `index.html` opens directly; other folders get a file detail page. Framework projects need compiled static output or separate hosting.

The dashboard supports add/edit/remove links, collections, search, favorites, drag ordering, keyboard-accessible move-to-top, saved light/dark mode, and JSON backup/restore. Hub customization and saved project records sync through the private Cloudflare Worker for signed-in devices. The browser keeps a local copy for offline use; changes sync when online. External linked apps require their own protection. Persistent project records use the same private sync, including Workpad instructions/notes, tasks, chats, habits, and drawing data. Temporary editor drafts and device-specific notification subscriptions remain local to each device.

### Appearance
Open **Settings** in the hub to choose Light, Dark, or System appearance and a restrained accent color (Mono, Blue, Sage, Violet, Rose, Amber). Backgrounds stay black/white by default; color is limited to actions and highlights. The hub and child projects share the preference, including changes made in another open tab. Theme buttons switch to an explicit light/dark choice; select System again in Settings to follow your device. Preferences sync to private workspace storage and are included in Export settings. Existing project records, chat history and task reminders are unaffected.

Settings previews theme changes immediately. **Cancel**, Escape, or closing the dialog restores the saved theme; **Save** keeps it. Optional Paper (warm) and Slate (cool) backgrounds work in both modes. **Reset look** previews System + Mono + Pure without changing your project data. A project's edit menu also offers a small color marker and a simple icon; neither is shown unless you choose one, except the default folder icon.

**Layout & typography** stays collapsed until needed. It includes the existing row spacing, width and description controls, plus System / Book / Mono typefaces and Balanced / Square / Soft corners. Fonts come from the device; code fields retain monospace. These settings share the same reversible preview and Save behavior. Reset look also returns typeface and corners to their defaults; it never removes projects, collections or project data.

Small navigation touches: `/` or **Ctrl/⌘ K** focuses project search; Escape clears that search. The tab title uses your workspace name, and the tab icon uses its first letter and your chosen accent. Custom project icons remain visible on mobile. Long names truncate neatly in the header.

Inside **Layout & typography**, **Export theme / Import theme** transfers only mode, accent, background tone, typeface and corners. It leaves collections, projects, ordering, spacing and task data alone. Import opens a preview until Save; Cancel restores the previous look. Full settings backup remains under Backup & project discovery. Theme files use a small validated JSON format and load no external assets.
