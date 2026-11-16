# Dock
A file explorer for projects. Run `npm run dev` and open http://localhost:3000. No dependencies required.

Add a folder to `projects/` and optionally a `project.json` descriptor; it appears automatically in development within 15 seconds and in published builds after `npm run build` and deployment. Each project can contain a static index.html or set a deployed `url`. Framework projects need a compiled static output or their own hosting.

The app supports collections, drag sorting and moving, search, favorites, project editing, grid/list views, appearance customization, and JSON settings backup/restore. Changes made in the UI are local to the browser. Export a backup to move them to another browser. A hosted browser cannot read your computer's filesystem; repository discovery runs during build/development.

## GitHub Pages
This repository targets https://ethangrandpre.github.io/ChatGPT/. In repository Settings → Pages, select **GitHub Actions** as the source. Push to main to deploy; every push scans projects/ again. All hub URLs support repository subpaths. Customizations and added links persist in this browser; repo projects persist in Git. GitHub Pages hosts static apps; server applications need a separate backend/deployed URL.

For a single deployment per push, set Settings → Pages → Source to GitHub Actions. The root index also forwards to the committed build as a fallback for repositories using legacy branch publishing.
