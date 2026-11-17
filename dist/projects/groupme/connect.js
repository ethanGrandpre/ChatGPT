const callback=new URL('callback.html',location.href).href;
document.getElementById('callback').textContent=callback;
document.getElementById('connect').onsubmit=event=>{
 event.preventDefault();const client=document.getElementById('client').value.trim();
 if(!/^[a-zA-Z0-9_-]{1,200}$/.test(client)){document.getElementById('status').textContent='Enter the Client ID, not an access token or URL.';return}
 const state=crypto.randomUUID();
 try{sessionStorage.setItem('groupme-oauth-state',JSON.stringify({state,created:Date.now()}))}catch{document.getElementById('status').textContent='This tab needs session storage to authorize safely.';return}
 const url=new URL('https://oauth.groupme.com/oauth/authorize');url.searchParams.set('client_id',client);url.searchParams.set('response_type','token');url.searchParams.set('state',state);location.assign(url.href);
};
