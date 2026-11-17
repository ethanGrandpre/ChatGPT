// Remove credentials from the address before other scripts or links can use it.
(()=>{
 const query=new URLSearchParams(location.search),fragment=new URLSearchParams(location.hash.slice(1));
 let token=fragment.get('access_token')||query.get('access_token');
 const state=fragment.get('state')||query.get('state'),error=fragment.get('error')||query.get('error');
 history.replaceState(null,'',location.pathname);
 let pending;try{pending=JSON.parse(sessionStorage.getItem('groupme-oauth-state')||'null');sessionStorage.removeItem('groupme-oauth-state')}catch{}
 const valid=!error&&token&&token.length<=4096&&pending&&state===pending.state&&Date.now()-pending.created>=0&&Date.now()-pending.created<15*60*1000;
 if(!valid)token=null;
 document.addEventListener('DOMContentLoaded',()=>{
  const status=document.getElementById('status');if(!valid){status.textContent='Authorization could not be verified. Start again from Connect GroupMe in this tab. If this repeats, GroupMe may not be returning the required state parameter.';return}
  status.textContent='Authorized. Finish the Cloudflare secret setup below.';document.getElementById('result').hidden=false;
  document.getElementById('copy').onclick=async()=>{try{await navigator.clipboard.writeText(token);document.getElementById('copy-status').textContent='Copied. Paste directly into the Cloudflare secret.'}catch{document.getElementById('copy-status').textContent='Clipboard access was blocked. Allow clipboard permission and try again.'}};
  document.getElementById('clear').onclick=()=>{token=null;document.getElementById('result').hidden=true;status.textContent='Token cleared from this page.'};
 });
 window.addEventListener('pagehide',()=>{token=null});
})();
