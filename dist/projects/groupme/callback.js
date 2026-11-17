// Credentials remain in memory only; scrub the URL before any other scripts run.
(()=>{
 const query=new URLSearchParams(location.search),fragment=new URLSearchParams(location.hash.slice(1));
 let token=fragment.get('access_token')||query.get('access_token');
 const state=fragment.get('state')||query.get('state'),error=fragment.get('error')||query.get('error');
 const known=['access_token','code','error','state','token'];
 const flags=params=>known.filter(key=>params.has(key)).join(', ')||'none';
 const diagnostic=`Return check: query fields: ${flags(query)}; fragment fields: ${flags(fragment)}.`;
 history.replaceState(null,'',location.pathname);
 let pending;try{pending=JSON.parse(sessionStorage.getItem('groupme-oauth-state')||'null');sessionStorage.removeItem('groupme-oauth-state')}catch{}
 const fresh=pending&&typeof pending.state==='string'&&Number.isFinite(pending.created)&&Date.now()-pending.created>=0&&Date.now()-pending.created<15*60*1000;
 const valid=!error&&token&&token.length<=4096&&fresh&&(!state||state===pending.state);
 let reason=error?'GroupMe declined authorization.':!token?'GroupMe returned no access token.':!fresh?'This tab’s authorization session is missing or expired.':state&&state!==pending.state?'The returned authorization state did not match.':'The returned token is invalid.';
 if(!valid)token=null;
 document.addEventListener('DOMContentLoaded',async()=>{
  const status=document.getElementById('status');if(!valid){status.textContent=reason+' '+diagnostic+' If you already saved the access-token secret in Cloudflare, choose Run GroupMe below. Otherwise use Access token setup instructions.';return}
  const reveal=()=>{document.getElementById('verify').hidden=true;document.getElementById('result').hidden=false;status.textContent='Account confirmed. Finish the Cloudflare secret setup below.'};
  document.getElementById('copy').onclick=async()=>{try{await navigator.clipboard.writeText(token);document.getElementById('copy-status').textContent='Copied. Paste directly into the Cloudflare secret.'}catch{document.getElementById('copy-status').textContent='Clipboard access was blocked. Allow clipboard permission and try again.'}};
  document.getElementById('clear').onclick=()=>{token=null;document.getElementById('result').hidden=true;status.textContent='Token cleared from this page.'};
  // GroupMe may omit OAuth state. Never install that credential automatically:
  // inspect its account and require explicit owner confirmation before manual export.
  status.textContent=state?'Verifying your GroupMe account…':'GroupMe did not return a state value. Verify the account below before copying its token.';
  try{
   const response=await fetch('/api/groupme/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),cache:'no-store',signal:AbortSignal.timeout(20000)});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Account verification failed.');
   if(!token)return;
   document.getElementById('verify').hidden=false;document.getElementById('account').textContent=`GroupMe account: ${data.name} (ID ${data.id}). Confirm only if this is your account.`;
   document.getElementById('confirm').disabled=false;document.getElementById('confirm').onclick=reveal;
  }catch(e){token=null;status.textContent=e.message||'Account verification failed. Start authorization again.'}
 });
 window.addEventListener('pagehide',()=>{token=null});
})();
