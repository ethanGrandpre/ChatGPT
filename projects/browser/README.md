# Browser web project
Hub → Browser → Run → run.html. This standalone HTML page contains a responsive browsing workspace with independent embedded tabs, requested-address navigation history, bookmarks, and light/dark mode stored locally.

Embedding is subject to destination X-Frame-Options/CSP and mixed-content rules. The address field and back/forward track addresses submitted through this app, not navigation within cross-origin frames (which browser security prevents reading). Web searches use an explicit external search-results link. Open externally uses the real host browser. There is no proxy or header-stripping bypass and this is not a replacement browser engine.

Optional experimental native source remains in native/browser/. Native builds are manual only; the web version does not depend on them.
