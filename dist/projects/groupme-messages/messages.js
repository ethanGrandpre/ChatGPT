const $=id=>document.getElementById(id);let mode='groups',groups=[],page=1,current=null,messages=[],generation=0,busy=false,source=crypto.randomUUID(),lastText='';
let connected=false,reading=0,listing=0,retryAt=0,liveTimer,lastList=0,lastAttempt=0,liveDelay=5000,stopped=false;
const status=text=>$('status').textContent=text;
async function api(action,options={}){
 let response;try{response=await fetch('/api/groupme/'+action,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(22000),...options})}catch{throw Error('Connection to Dock failed or timed out. Check your connection and reconnect.')}
 let data;try{data=await response.json()}catch{throw Error('Dock returned a sign-in page or unreadable response. Sign into Dock again and reload.')}
 $('release').textContent='Client: groupme-dms-1 · Backend: '+(data.release||'older version');
 if(data.release!=='groupme-dms-1')throw Error('This is an older Worker deployment. Wait for the newest Cloudflare deployment, then reload.');
 if(response.status===429)retryAt=Date.now()+60000;
 if(!response.ok)throw Error((data.error||'GroupMe request failed.')+' ['+(data.code||response.status)+']');
 return data.response;
}
function renderGroups(){const q=$('search').value.toLowerCase();$('groups').replaceChildren();for(const group of groups.filter(g=>g.name.toLowerCase().includes(q))){const button=document.createElement('button');button.textContent=group.name;button.setAttribute('aria-pressed',String(current?.id===group.id));button.onclick=()=>{if(busy)return;if($('text').value&&!confirm('Discard your unsent message and switch conversations?'))return;current=group;$('send-status').textContent='';source=crypto.randomUUID();lastText='';generation++;messages=[];$('text').value='';$('compose').hidden=false;$('title').textContent=group.name;$('refresh').disabled=false;$('text').disabled=false;$('send').disabled=false;renderGroups();loadMessages()};$('groups').append(button)}}
async function loadGroups(more=false,quiet=false){
 if(busy)return false;listing++;const listMode=mode;$('refresh-groups').disabled=true;$('more-groups').disabled=true;$('refresh-groups').textContent='Connecting…';$('status').dataset.error='false';
 if(!quiet)status('Checking your saved GroupMe account…');
 try{
  if(!quiet){const account=await api('status');connected=true;$('account').textContent='Connected as '+account.name;status('Connected. Loading conversations…')}
  const next=more?page+1:1,data=await api((mode==='dms'?'chats':'groups')+'?page='+next);if(listMode!==mode)return;if(!Array.isArray(data))throw Error('GroupMe returned an unexpected group list.');
  const entries=listMode==='dms'?data.filter(chat=>chat.other_user?.id).map(chat=>({id:String(chat.other_user.id),name:chat.other_user.name||'GroupMe user'})):data;
  groups=(more||quiet)?[...new Map([...groups,...entries].map(g=>[String(g.id),{...g,id:String(g.id)}])).values()]:entries.map(g=>({...g,id:String(g.id)}));if(!quiet)page=next;lastList=Date.now();
  if(!quiet)$('more-groups').hidden=data.length<100;renderGroups();if(!quiet)status(groups.length?`${groups.length} ${mode==='dms'?'direct conversations':'groups'} loaded. Select one to read messages.`:`Connected successfully. No ${mode==='dms'?'direct conversations':'groups'} found.`);$('setup').hidden=true;return true;
 }catch(e){if(listMode!==mode)return;$('status').dataset.error='true';status(e.message);$('setup').hidden=false;return false}
 finally{listing--;if(listMode!==mode)return;$('refresh-groups').disabled=false;$('refresh-groups').textContent='Connect / refresh';$('more-groups').disabled=false}
}
function renderMessages(){const root=$('messages');root.replaceChildren();for(const message of [...messages].sort((a,b)=>a.created_at-b.created_at)){const row=document.createElement('article');row.className='message';const header=document.createElement('header'),name=document.createElement('strong'),time=document.createElement('time');name.textContent=message.name||'Group member';const date=new Date(message.created_at*1000);time.textContent=Number.isNaN(date.valueOf())?'':date.toLocaleString();header.append(name,time);const text=document.createElement('p');text.textContent=message.text||'';row.append(header,text);if(message.attachments?.length){const note=document.createElement('small');note.textContent='Attachments · view them in GroupMe';row.append(note)}root.append(row)}if(!messages.length)root.textContent='No messages yet.'}
async function loadMessages(older=false,live=false){
 if(!current)return false;reading++;const id=current.id,conversationMode=mode,version=++generation;
 if(!live){$('refresh').disabled=true;$('older').disabled=true;status('Loading messages…')}
 try{
  const before=older?messages.reduce((old,m)=>!old||m.created_at<old.created_at?m:old,null)?.id:null;
  const data=await api((conversationMode==='dms'?'direct-messages?user=':'messages?group=')+encodeURIComponent(id)+(before?'&before='+encodeURIComponent(before):''));
  if(version!==generation)return false;
  const incoming=(conversationMode==='dms'?data.direct_messages:data.messages)||[];
  const root=$('messages'),top=root.scrollTop||0,nearBottom=(root.scrollHeight||0)-top-(root.clientHeight||0)<80;
  const next=(older||live)?[...new Map([...messages,...incoming].map(m=>[m.id,m])).values()]:incoming;
  if(JSON.stringify(next)!==JSON.stringify(messages)||!root.children.length){const oldHeight=root.scrollHeight||0;messages=next;renderMessages();root.scrollTop=older?top+Math.max(0,(root.scrollHeight||0)-oldHeight):live&&!nearBottom?top:root.scrollHeight}
  if(!live){$('older').hidden=incoming.length<40;status('Updated '+new Date().toLocaleTimeString());if(!older)root.scrollTop=root.scrollHeight}
  if(live&&$('status').dataset.error==='true'){status('Reconnected · messages are updating automatically.');$('status').dataset.error='false'}
  return true;
 }catch(e){if(version===generation){status(e.message);$('status').dataset.error='true'}return false}
 finally{reading--;if(version===generation&&!live){$('refresh').disabled=false;$('older').disabled=false}}
}
$('compose').onsubmit=async event=>{
 event.preventDefault();const text=$('text').value.trim();if(!text||!current||busy)return;
 if(text!==lastText){source=crypto.randomUUID();lastText=text}
 busy=true;$('send').disabled=true;$('text').disabled=true;$('send-status').textContent='Sending…';
 try{
  await api(mode==='dms'?'send-direct':'send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({[mode==='dms'?'user':'group']:String(current.id),text,source})});
  $('text').value='';source=crypto.randomUUID();lastText='';$('send-status').textContent='Sent.';
  const refreshed=await loadMessages();if(!refreshed)$('send-status').textContent='Sent. Conversation refresh failed; use Refresh to check for updates. Do not resend.';
 }catch(e){$('send-status').textContent=e.message+' Your draft is still here. No automatic resend was attempted.'}
 finally{busy=false;$('send').disabled=false;$('text').disabled=false}
};
function switchMode(next){
 if(busy||mode===next)return;if($('text').value&&!confirm('Discard your unsent message and switch conversations?'))return;
 mode=next;$('send-status').textContent='';generation++;current=null;messages=[];groups=[];page=1;$('text').value='';$('compose').hidden=true;$('messages').replaceChildren();$('title').textContent='Choose a conversation';$('refresh').disabled=true;$('older').hidden=true;$('more-groups').hidden=true;$('search').value='';$('list-title').textContent=mode==='dms'?'Direct messages':'Groups';
 $('tab-groups').setAttribute('aria-pressed',String(mode==='groups'));$('tab-dms').setAttribute('aria-pressed',String(mode==='dms'));renderGroups();loadGroups();
}
$('tab-groups').onclick=()=>switchMode('groups');$('tab-dms').onclick=()=>switchMode('dms');
$('search').oninput=renderGroups;$('refresh-groups').onclick=()=>loadGroups();$('more-groups').onclick=()=>loadGroups(true);$('refresh').onclick=()=>loadMessages();$('older').onclick=()=>loadMessages(true);$('theme').onclick=()=>DockAppearance.toggleTheme();window.addEventListener('beforeunload',e=>{if($('text').value){e.preventDefault();e.returnValue=''}});loadGroups();

function scheduleLive(delay=5000){clearTimeout(liveTimer);if(!stopped)liveTimer=setTimeout(pollLive,delay)}
async function pollLive(){
 if(stopped)return;
 if(document.visibilityState!=='visible'||navigator.onLine===false){$('live-status').textContent='Live updates paused';scheduleLive();return}
 if(Date.now()<retryAt){$('live-status').textContent='Live updates waiting · rate limit';scheduleLive(Math.max(5000,retryAt-Date.now()));return}
 if(busy||reading||listing||Date.now()-lastAttempt<4500){scheduleLive();return}
 lastAttempt=Date.now();let ok=true;
 try{
  if(!connected)ok=await loadGroups();
  else{
   if(current)ok=await loadMessages(false,true);
   if(ok&&Date.now()-lastList>=30000&&Date.now()>=retryAt)ok=await loadGroups(false,true);
  }
 }finally{
  liveDelay=ok?5000:Math.min(60000,liveDelay*2);
  $('live-status').textContent=ok?'Live · checks every 5 sec':'Live updates retrying…';scheduleLive(liveDelay);
 }
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleLive(0)});
window.addEventListener('online',()=>scheduleLive(0));window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(liveTimer)});window.addEventListener('pageshow',()=>{stopped=false;scheduleLive()});scheduleLive();
