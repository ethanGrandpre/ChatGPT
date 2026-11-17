import { groupme } from './groupme.js';
import bundledAssets from './assets.generated.js';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';

const keySets = new Map();
const encoder = new TextEncoder();
const COOKIE = '__Host-dock_verified';
// Project apps may run inside the same-origin Desktop shell. Cross-origin framing
// remains blocked, and the CSP frame-ancestors policy below is still enforced.
const noCache = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN' };
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reply = (text, status = 200, headers = {}) => new Response(text, { status, headers: { ...noCache, ...headers } });

export function configuration(env) {
  try {
    const team = new URL(env.ACCESS_TEAM_DOMAIN);
    if (team.protocol !== 'https:' || !team.hostname.endsWith('.cloudflareaccess.com') || team.pathname !== '/' || team.search || team.hash || team.port || team.username || team.password) return null;
    if (!env.ACCESS_AUD || !env.OWNER_EMAIL || !env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return null;
    return { issuer: team.origin, audience: env.ACCESS_AUD, owner: env.OWNER_EMAIL.trim().toLowerCase() };
  } catch { return null; }
}

export async function verifyIdentity(request, config, keyResolver) {
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) throw new Error('Unauthenticated');
  let keys = keyResolver;
  if (!keys) {
    if (!keySets.has(config.issuer)) keySets.set(config.issuer, createRemoteJWKSet(new URL(config.issuer + '/cdn-cgi/access/certs'), { timeoutDuration: 5000 }));
    keys = keySets.get(config.issuer);
  }
  const { payload } = await jwtVerify(token, keys, { issuer: config.issuer, audience: config.audience, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub', 'email'] });
  if (typeof payload.email !== 'string' || payload.email.toLowerCase() !== config.owner || payload.type !== 'app' || typeof payload.sub !== 'string') throw new Error('Forbidden');
  return payload;
}

async function verifiedSession(request, env, identity) {
  const cookie = request.headers.get('Cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!cookie) return false;
  try {
    await jwtVerify(cookie, encoder.encode(env.SESSION_SECRET), { algorithms: ['HS256'], issuer: new URL(request.url).origin, audience: 'dock-bot-check', subject: identity.sub, requiredClaims: ['exp', 'iat', 'sub'] });
    return true;
  } catch { return false; }
}

function challengePage(env, request) {
  const nonce = crypto.randomUUID();
  const pathname = new URL(request.url).pathname;
  // Use an absolute same-origin destination and JSON-escape it to prevent open redirects.
  const destination = pathname === '/_security/verify' ? '/' : new URL(request.url).href;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verify — Dock</title><style nonce="${nonce}">:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font:14px/1.6 system-ui;background:#fff;color:#171717}main{max-width:360px;padding:24px}h1{font-size:22px;font-weight:500}p{color:#737373;font-size:13px}a{color:inherit}#status{min-height:24px}@media(prefers-color-scheme:dark){body{background:#000;color:#ededed}p{color:#929292}}</style></head><body><main><h1>One quick check</h1><p>You’re signed in. Complete this check to open your workspace.</p><div class="cf-turnstile" data-sitekey="${escape(env.TURNSTILE_SITE_KEY)}" data-action="dock_login" data-callback="onVerified" data-error-callback="onError" data-expired-callback="onExpired"></div><p id="status" role="status"></p><a href="/cdn-cgi/access/logout">Sign out</a></main><script nonce="${nonce}">window.onError=()=>{document.querySelector('#status').textContent='Verification could not load. Refresh to try again.'};window.onExpired=()=>{document.querySelector('#status').textContent='Verification expired. Try again.'};window.onVerified=async(token)=>{const status=document.querySelector('#status');status.textContent='Verifying…';try{const r=await fetch('/_security/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});if(!r.ok)throw Error();location.replace(${JSON.stringify(destination).replace(/</g,'\\u003c')})}catch{status.textContent='Verification failed. Please try again.';if(window.turnstile)turnstile.reset()}};</script><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script></body></html>`;
  return reply(html, 200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}' https://challenges.cloudflare.com; style-src 'nonce-${nonce}'; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'` });
}

export function createHandler({ identityVerifier = verifyIdentity, networkFetch = fetch.bind(globalThis) } = {}) {
  return async function handle(request, env, ctx) {
    const config = configuration(env);
    let identity;
    const nativeAccess = !!ctx?.access;
    if (!nativeAccess && !config) return reply('Sign-in required. Enable Cloudflare Access for this Worker.', 403);
    try {
      if (nativeAccess) {
        const user = await ctx.access.getIdentity();
        if (!user?.email || user.email.toLowerCase() !== (env.OWNER_EMAIL || '').trim().toLowerCase()) throw Error('Forbidden');
        identity = { email: user.email, sub: user.id || user.email.toLowerCase() };
      } else identity = await identityVerifier(request, config);
    }
    catch { return reply('Sign-in required. Only the workspace owner can access this site.', 403); }
    const botConfigured = !!(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY && env.SESSION_SECRET?.length >= 32);
    const botPartial = !!(env.TURNSTILE_SITE_KEY || env.TURNSTILE_SECRET_KEY || env.SESSION_SECRET);
    if (botPartial && !botConfigured) return reply('Bot protection configuration is incomplete.', 503);
    const botRequired = botConfigured || !nativeAccess;
    const url = new URL(request.url);
    if (url.pathname === '/_security/identity') {
      if (botRequired && !(await verifiedSession(request, env, identity))) return reply('Verification required.', 403);
      return reply(JSON.stringify({ email: identity.email, logoutUrl: '/_security/logout' }), 200, { 'Content-Type': 'application/json' });
    }
    if (url.pathname === '/_security/logout') {
      return reply('', 303, { Location: '/cdn-cgi/access/logout', 'Set-Cookie': `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0` });
    }
    if (url.pathname === '/_security/verify') {
      if (!botConfigured) return reply('Turnstile is not configured.', 503);
      if (request.method !== 'POST') return reply('Method not allowed.', 405, { Allow: 'POST' });
      if (request.headers.get('Origin') !== url.origin) return reply('Invalid origin.', 403);
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) return reply('Expected JSON.', 415);
      // A bounded stream prevents both a forged Content-Length and an unbounded body.
      let length = 0, text = '';
      try { for await (const chunk of request.body || []) { length += chunk.length; if (length > 4096) return reply('Request too large.', 413); text += new TextDecoder().decode(chunk); } }
      catch { return reply('Invalid request.', 400); }
      let token;
      try { token = JSON.parse(text).token; } catch { return reply('Invalid request.', 400); }
      if (typeof token !== 'string' || !token || token.length > 2048) return reply('Invalid verification token.', 400);
      let result;
      try {
        const response = await networkFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: request.headers.get('cf-connecting-ip') || undefined }), signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error('Siteverify unavailable');
        result = await response.json();
      } catch { return reply('Verification service unavailable. Try again.', 503); }
      if (!result.success || result.hostname !== url.hostname || result.action !== 'dock_login') return reply('Verification failed.', 403);
      const session = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setIssuer(url.origin).setAudience('dock-bot-check').setSubject(identity.sub).setIssuedAt().setExpirationTime('1h').sign(encoder.encode(env.SESSION_SECRET));
      return reply(JSON.stringify({ ok: true }), 200, { 'Content-Type': 'application/json', 'Set-Cookie': `${COOKIE}=${session}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=3600` });
    }
    if (url.pathname === '/api/tasks-push') {
      if (botRequired && !(await verifiedSession(request, env, identity))) return reply('Verification required.',403);
      if (!env.TASK_PUSH) return reply(JSON.stringify({configured:false,error:'Notification storage is not configured in this deployment.'}),503,{'Content-Type':'application/json'});
      if (!['GET','POST'].includes(request.method)) return reply('Method not allowed.',405);
      if (request.method==='POST' && (request.headers.get('Origin')!==url.origin || !request.headers.get('Content-Type')?.startsWith('application/json'))) return reply('Invalid origin or content type.',403);
      const objectId=env.TASK_PUSH.idFromName(identity.email.toLowerCase());
      return env.TASK_PUSH.get(objectId).fetch(request);
    }
    if (url.pathname === '/api/project-sync') {
      if (botRequired && !(await verifiedSession(request, env, identity))) return reply('Verification required.',403);
      if (!env.TASK_PUSH) return reply(JSON.stringify({error:'Sync storage is not configured in this deployment.'}),503,{'Content-Type':'application/json'});
      if (!['GET','POST'].includes(request.method)) return reply('Method not allowed.',405,{Allow:'GET, POST'});
      if (request.method==='POST' && (request.headers.get('Origin')!==url.origin || !request.headers.get('Content-Type')?.startsWith('application/json'))) return reply('Invalid origin or content type.',403);
      const objectId=env.TASK_PUSH.idFromName(identity.email.toLowerCase());
      return env.TASK_PUSH.get(objectId).fetch(request);
    }
    if(url.pathname==='/api/groupme-push'){
      if(botRequired&&!(await verifiedSession(request,env,identity)))return reply('Verification required.',403);
      if(!env.GROUPME_PUSH)return reply(JSON.stringify({error:'GroupMe push storage is not deployed yet. Wait for the latest deployment.'}),503,{'Content-Type':'application/json'});
      if(!['GET','POST'].includes(request.method))return reply('Method not allowed.',405);
      if(request.method==='POST'&&(request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.startsWith('application/json')))return reply('Invalid origin or content type.',403);
      return env.GROUPME_PUSH.get(env.GROUPME_PUSH.idFromName(identity.email.toLowerCase())).fetch(request);
    }
    if (url.pathname.startsWith('/api/groupme/')) {
      if (botRequired && !(await verifiedSession(request, env, identity))) return reply('Verification required.',403);
      return groupme(request, env, networkFetch);
    }
    if (!['GET', 'HEAD'].includes(request.method)) return reply('Method not allowed.', 405, { Allow: 'GET, HEAD' });
    if (botRequired && !(await verifiedSession(request, env, identity))) {
      if (request.headers.get('Accept')?.includes('text/html')) return challengePage(env, request);
      return reply('Verification required.', 403);
    }
    if (url.pathname === '/_browser/status' || url.pathname === '/_browser/socket') {
      let endpoint;
      try { endpoint = new URL(env.BROWSER_SERVER_URL); if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) throw Error(); } catch { return reply(JSON.stringify({configured:false,message:'Start the browser server on your Mac and connect it in Cloudflare settings.'}),503,{'Content-Type':'application/json'}); }
      if (!env.BROWSER_SERVER_SECRET || env.BROWSER_SERVER_SECRET.length < 32) return reply(JSON.stringify({configured:false,message:'Browser server secret is missing.'}),503,{'Content-Type':'application/json'});
      if (url.pathname === '/_browser/status') {
        try {
          const health = await networkFetch(new Request(new URL('/health', endpoint), {signal:AbortSignal.timeout(2500), redirect:'error'}));
          if (!health.ok) throw Error();
          return reply(JSON.stringify({configured:true,online:true}),200,{'Content-Type':'application/json'});
        } catch {
          return reply(JSON.stringify({configured:true,online:false,message:'The browser server is configured, but your Mac or its Cloudflare tunnel is offline. Start the browser server and tunnel on your Mac, then retry.'}),503,{'Content-Type':'application/json'});
        }
      }
      if (request.headers.get('Origin') !== url.origin) return reply('Invalid origin.',403);
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return reply('WebSocket connection required.',426);
      const headers = new Headers({Upgrade:'websocket',Origin:url.origin,Authorization:'Bearer '+env.BROWSER_SERVER_SECRET});
      try { return await networkFetch(new Request(new URL('/stream',endpoint),{headers,redirect:'error'})); }
      catch { return reply('Browser server unavailable. Check that your Mac server and tunnel are running.',502); }
    }
    let response;
    if (env.ASSETS) response = await env.ASSETS.fetch(request);
    else {
      const path = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
      const encoded = bundledAssets[path];
      if (!encoded) return reply('Not found.', 404);
      const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
      const ext = path.split('.').pop();
      const types = { html:'text/html; charset=utf-8', js:'text/javascript; charset=utf-8', css:'text/css; charset=utf-8', json:'application/json', svg:'image/svg+xml', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', ico:'image/x-icon', txt:'text/plain; charset=utf-8', md:'text/plain; charset=utf-8',webmanifest:'application/manifest+json' };
      response = new Response(request.method === 'HEAD' ? null : bytes, {headers:{'Content-Type':types[ext] || 'application/octet-stream'}});
    }
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(noCache)) headers.set(key, value);
    headers.set('Vary', 'Cookie, Cf-Access-Jwt-Assertion');
    return new Response(response.body, { status: response.status, headers });
  };
}
export default { fetch: createHandler() };

export {TaskPush} from './task-push.js';

export {GroupMePush} from './groupme-push.js';
