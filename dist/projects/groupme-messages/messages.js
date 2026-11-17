const TEXT_SIZE_KEY='dock-groupme-text-size-v1';
function normalizedTextSize(value){const n=Number(value);return Number.isFinite(n)&&n>=12&&n<=24?Math.round(n):14}
function applyTextSize(value){const size=normalizedTextSize(value);$('text-size').value=String(size);$('text-size-value').textContent=size+'px';$('messages').style.setProperty('--message-text-size',size+'px');$('text').style.setProperty('--message-text-size',size+'px')}
function loadTextSize(){try{applyTextSize(localStorage.getItem(TEXT_SIZE_KEY))}catch{applyTextSize(14)}}
const emojiBase=String.raw`(?!(?:\p{Emoji_Modifier}|\p{Regional_Indicator}))[\p{Extended_Pictographic}\p{Emoji_Presentation}]\uFE0F?\p{Emoji_Modifier}?(?:[\u{E0020}-\u{E007E}]+\u{E007F})?`;
const emojiAtom=String.raw`(?:\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|${emojiBase})`;
const emojiOnlyPattern=new RegExp(String.raw`^(?:${emojiAtom}(?:\u200D${emojiAtom})*\s*)+$`,'u');
function isEmojiOnly(value){return emojiOnlyPattern.test(String(value||'').trim())}
const $=id=>document.getElementById(id);let mode='groups',groups=[],page=1,current=null,messages=[],generation=0,busy=false,source=crypto.randomUUID(),lastText='';
let ownerId='',replyTarget=null;const deletedMessages=new Set();
let connected=false,reading=0,listing=0,retryAt=0,liveTimer,lastList=0,lastAttempt=0,liveDelay=5000,stopped=false;
const status=text=>$('status').textContent=text;
async function api(action,options={}){
 let response;try{response=await fetch('/api/groupme/'+action,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(22000),...options})}catch{throw Error('Connection to Dock failed or timed out. Check your connection and reconnect.')}
 let data;try{data=await response.json()}catch{throw Error('Dock returned a sign-in page or unreadable response. Sign into Dock again and reload.')}
 $('release').textContent='Client: groupme-dms-readonly-1 · Backend: '+(data.release||'older version');
 if(data.release!=='groupme-dms-readonly-1')throw Error('This is an older Worker deployment. Wait for the newest Cloudflare deployment, then reload.');
 if(response.status===429)retryAt=Date.now()+60000;
 if(!response.ok)throw Error((data.error||'GroupMe request failed.')+' ['+(data.code||response.status)+']');
 return data.response;
}
function renderGroups(){const q=$('search').value.toLowerCase();$('groups').replaceChildren();for(const group of groups.filter(g=>g.name.toLowerCase().includes(q))){const button=document.createElement('button');button.textContent=group.name;button.setAttribute('aria-pressed',String(current?.id===group.id));button.onclick=()=>{if(busy)return;if(($('text').value||replyTarget)&&!confirm('Discard your unsent message and switch conversations?'))return;current=group;clearReply();$('send-status').textContent='';source=crypto.randomUUID();lastText='';generation++;messages=[];$('text').value='';$('compose').hidden=mode==='dms';$('dm-note').hidden=mode!=='dms';$('title').textContent=group.name;$('refresh').disabled=false;$('text').disabled=false;$('send').disabled=false;renderGroups();loadMessages()};$('groups').append(button)}}
async function loadGroups(more=false,quiet=false){
 if(busy)return false;listing++;const listMode=mode;$('refresh-groups').disabled=true;$('more-groups').disabled=true;$('refresh-groups').textContent='Connecting…';$('status').dataset.error='false';
 if(!quiet)status('Checking your saved GroupMe account…');
 try{
  if(!quiet){const account=await api('status');connected=true;ownerId=String(account.id);$('account').textContent='Connected as '+account.name;status('Connected. Loading conversations…')}
  const next=more?page+1:1,data=await api((mode==='dms'?'chats':'groups')+'?page='+next);if(listMode!==mode)return;if(!Array.isArray(data))throw Error('GroupMe returned an unexpected group list.');
  const entries=listMode==='dms'?data.filter(chat=>chat.other_user?.id).map(chat=>({id:String(chat.other_user.id),name:chat.other_user.name||'GroupMe user'})):data;
  groups=(more||quiet)?[...new Map([...groups,...entries].map(g=>[String(g.id),{...g,id:String(g.id)}])).values()]:entries.map(g=>({...g,id:String(g.id)}));if(!quiet)page=next;lastList=Date.now();
  if(!quiet)$('more-groups').hidden=data.length<100;renderGroups();if(!quiet)status(groups.length?`${groups.length} ${mode==='dms'?'direct conversations':'groups'} loaded. Select one to read messages.`:`Connected successfully. No ${mode==='dms'?'direct conversations':'groups'} found.`);$('setup').hidden=true;return true;
 }catch(e){if(listMode!==mode)return;$('status').dataset.error='true';status(e.message);$('setup').hidden=false;return false}
 finally{listing--;if(listMode!==mode)return;$('refresh-groups').disabled=false;$('refresh-groups').textContent='Connect / refresh';$('more-groups').disabled=false}
}
function renderMessages(){const root=$('messages');root.replaceChildren();for(const message of [...messages].filter(m=>!deletedMessages.has(current?.id+':'+m.id)).sort((a,b)=>a.created_at-b.created_at)){const row=document.createElement('article');row.className='message';const header=document.createElement('header'),name=document.createElement('strong'),time=document.createElement('time');name.textContent=message.name||'Group member';const date=new Date(message.created_at*1000);time.textContent=Number.isNaN(date.valueOf())?'':date.toLocaleString();header.append(name,time);const text=document.createElement('p');text.textContent=message.text||'';text.className=isEmojiOnly(message.text)?'emoji-only':'';row.append(header,text);if(message.attachments?.length){const note=document.createElement('small');note.textContent='Attachments · view them in GroupMe';row.append(note)}if(mode==='groups'){
 const actions=document.createElement('div');actions.className='message-actions';const favorites=Array.isArray(message.favorited_by)?message.favorited_by.map(String):[],liked=favorites.includes(ownerId);
 const heart=document.createElement('button');heart.type='button';heart.textContent=(liked?'♥':'♡')+' '+favorites.length;heart.setAttribute('aria-label',liked?'Remove heart reaction':'React with a heart');heart.setAttribute('aria-pressed',String(liked));heart.onclick=()=>reactToMessage(message,liked);
 const reply=document.createElement('button');reply.type='button';reply.textContent='Reply';reply.onclick=()=>{if(busy)return;replyTarget={id:message.id,name:message.name||'Member',text:message.text||'[Attachment]'};$('reply-bar').hidden=false;$('reply-preview').textContent='Quoted reply to '+replyTarget.name+': '+replyTarget.text.slice(0,120);$('text').maxLength=1000-replyPrefix().length;$('text').focus()};actions.append(heart,reply);
 if(ownerId&&String(message.user_id)===ownerId){const trash=document.createElement('button');trash.type='button';trash.textContent='Delete';trash.setAttribute('aria-label','Delete your message');trash.onclick=()=>deleteMessage(message);actions.append(trash)}row.append(actions)
 }root.append(row)}if(!messages.length)root.textContent='No messages yet.'}
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
$('text').onkeydown=event=>{
 if(event.key!=='Enter'||event.shiftKey||event.isComposing||event.keyCode===229)return;
 event.preventDefault();
 if(event.repeat||busy||!current||mode==='dms'||!$('text').value.trim()||$('send').disabled)return;
 $('compose').requestSubmit();
};
$('compose').onsubmit=async event=>{
 event.preventDefault();if(mode==='dms'){$('send-status').textContent='DMs are read-only because GroupMe does not allow DM sending through its Developer API.';return}const draft=$('text').value.trim(),text=replyPrefix()+draft;if(!draft||!current||busy)return;if(text.length>1000){$('send-status').textContent='Shorten your reply to fit the 1,000 character message limit.';return}
 if(text!==lastText){source=crypto.randomUUID();lastText=text}
 busy=true;$('send').disabled=true;$('text').disabled=true;$('send-status').textContent='Sending…';
 try{
  await api('send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({group:String(current.id),text,source})});
  $('text').value='';clearReply();source=crypto.randomUUID();lastText='';$('send-status').textContent='Sent.';
  const refreshed=await loadMessages();if(!refreshed)$('send-status').textContent='Sent. Conversation refresh failed; use Refresh to check for updates. Do not resend.';
 }catch(e){$('send-status').textContent=e.message+' Your draft is still here. No automatic resend was attempted.'}
 finally{busy=false;$('send').disabled=false;$('text').disabled=false}
};
function switchMode(next){
 if(busy||mode===next)return;if(($('text').value||replyTarget)&&!confirm('Discard your unsent message and switch conversations?'))return;
 mode=next;clearReply();$('dm-note').hidden=mode!=='dms';$('send-status').textContent='';generation++;current=null;messages=[];groups=[];page=1;$('text').value='';$('compose').hidden=true;$('messages').replaceChildren();$('title').textContent='Choose a conversation';$('refresh').disabled=true;$('older').hidden=true;$('more-groups').hidden=true;$('search').value='';$('list-title').textContent=mode==='dms'?'Direct messages':'Groups';
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

function replyPrefix(){return replyTarget?'> '+replyTarget.name.slice(0,60)+': '+replyTarget.text.slice(0,250).replace(/\n/g,'\n> ')+'\n\n':''}
function clearReply(){replyTarget=null;$('reply-bar').hidden=true;$('text').maxLength=1000}
$('cancel-reply').onclick=clearReply;
async function reactToMessage(message,liked){
 if(busy||mode!=='groups'||!current)return;busy=true;const id=current.id;
 try{const result=await api('react',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({group:id,message:String(message.id),liked:!liked})});
  if(result?.confirmed!==true||String(result.message_id)!==String(message.id)||!Array.isArray(result.favorited_by))throw Error('The server did not confirm the saved GroupMe reaction. Reload after deployment.');
  messages=messages.map(m=>String(m.id)===String(message.id)?{...m,favorited_by:result.favorited_by}:m);
  const top=$('messages').scrollTop;renderMessages();$('messages').scrollTop=top;status(liked?'Heart removal confirmed by GroupMe.':'Heart confirmed by GroupMe.');
 }catch(e){status(e.message)}finally{busy=false}
}

async function deleteMessage(message){
 if(busy||mode!=='groups'||!current||String(message.user_id)!==ownerId)return;
 if(!confirm('Delete this message from GroupMe? This cannot be undone.'))return;busy=true;const group=current.id;
 try{await api('delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({group,message:String(message.id)})});deletedMessages.add(group+':'+message.id);if(replyTarget?.id===message.id)clearReply();renderMessages();status('Message deleted from GroupMe.')}
 catch(e){status(e.message+' Nothing was removed from this view.')}finally{busy=false}
}

loadTextSize();
$('text-size').oninput=()=>{const size=normalizedTextSize($('text-size').value);applyTextSize(size);try{localStorage.setItem(TEXT_SIZE_KEY,String(size))}catch{status('Text size changed for this session; browser storage is unavailable.')}};
window.addEventListener('storage',event=>{if(event.key===TEXT_SIZE_KEY||event.key===null)loadTextSize()});
