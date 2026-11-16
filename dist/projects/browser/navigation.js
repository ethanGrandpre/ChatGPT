export function classify(url, search = false) {
  const u = new URL(url);
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw Error('Use an http or https address without embedded credentials.');
  const host = u.hostname.toLowerCase();
  const google = /(^|\.)google\.[a-z]{2,}(\.[a-z]{2,})?$/.test(host);
  const knownExternal = google || ['bing.com','duckduckgo.com','yahoo.com','github.com','youtube.com','chatgpt.com'].some(d => host === d || host.endsWith('.'+d));
  return {url:u.href,search:search || (google && u.pathname === '/search'),external:search || knownExternal};
}
export function destination(input) {
  const text = input.trim(); if (!text) return null;
  let url; try {url = new URL(text)} catch {}
  if (url) return classify(url.href);
  if (/^\S+\.\S+/.test(text) && !text.includes(' ')) return classify('https://'+text);
  return classify('https://www.google.com/search?q='+encodeURIComponent(text), true);
}
