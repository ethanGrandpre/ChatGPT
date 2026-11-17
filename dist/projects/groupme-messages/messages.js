const TEXT_SIZE_KEY='dock-groupme-text-size-v1';
function normalizedTextSize(value){const n=Number(value);return Number.isFinite(n)&&n>=12&&n<=24?Math.round(n):14}
function applyTextSize(value){const size=normalizedTextSize(value);$('text-size').value=String(size);$('text-size-value').textContent=size+'px';$('messages').style.setProperty('--message-text-size',size+'px');$('text').style.setProperty('--message-text-size',size+'px')}
function loadTextSize(){try{applyTextSize(localStorage.getItem(TEXT_SIZE_KEY))}catch{applyTextSize(14)}}
const emojiBase=String.raw`(?!(?:\p{Emoji_Modifier}|\p{Regional_Indicator}))[\p{Extended_Pictographic}\p{Emoji_Presentation}]\uFE0F?\p{Emoji_Modifier}?(?:[\u{E0020}-\u{E007E}]+\u{E007F})?`;
const emojiAtom=String.raw`(?:\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|${emojiBase})`;
const emojiOnlyPattern=new RegExp(String.raw`^(?:${emojiAtom}(?:\u200D${emojiAtom})*\s*)+$`,'u');
function isEmojiOnly(value){return emojiOnlyPattern.test(String(value||'').trim())}
const $=id=>document.getElementById(id);let mode='groups',groups=[],page=1,current=null,messages=[],generation=0,busy=false,source=crypto.randomUUID(),lastText='';
let ownerId='',replyTarget=null,messageQuery='',newMessageCount=0,listSignature='';const deletedMessages=new Set();
let initialChat;try{const value=new URL(location.href).searchParams.get('chat');if(/^(groups|dms):\d{1,30}$/.test(value||''))initialChat=value}catch{}
let keyboardSend=false;
let connected=false,reading=0,listing=0,retryAt=0,liveTimer,lastList=0,lastAttempt=0,liveDelay=5000,stopped=false;
const status=text=>{$('status').textContent=text;$('list-status').textContent=text};
async function api(action,options={}){
 let response;try{response=await fetch('/api/groupme/'+action,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(22000),...options})}catch{throw Error('Connection to Dock failed or timed out. Check your connection and reconnect.')}
 let data;try{data=await response.json()}catch{throw Error('Dock returned a sign-in page or unreadable response. Sign into Dock again and reload.')}
 $('release').textContent='Client: groupme-notify-emoji-1 · Backend: '+(data.release||'older version');
 if(data.release!=='groupme-notify-emoji-1')throw Error('This is an older Worker deployment. Wait for the newest Cloudflare deployment, then reload.');
 if(response.status===429)retryAt=Date.now()+60000;
 if(!response.ok)throw Error((data.error||'GroupMe request failed.')+' ['+(data.code||response.status)+']');
 return data.response;
}
function renderGroups(){const q=$('search').value.toLowerCase(),signature=JSON.stringify([mode,q,current?.id,groups.map(g=>[g.id,g.name,unreadCount(g)])]);if(signature===listSignature)return;listSignature=signature;$('groups').replaceChildren();for(const group of groups.filter(g=>g.name.toLowerCase().includes(q))){const button=document.createElement('button');button.textContent=group.name;const unread=unreadCount(group);if(unread){const badge=document.createElement('span');badge.className='unread-badge';badge.textContent=unread>999?'999+':String(unread);badge.setAttribute('aria-label',unread+' unread messages');button.append(badge);button.setAttribute('aria-label',group.name+', '+unread+' unread messages')}button.setAttribute('aria-pressed',String(current?.id===group.id));button.onclick=()=>{if(busy)return;if(current?.id===group.id){$('chat-app').dataset.panel='conversation';markRead();return}saveDraft();current=group;window.DockGroupMeNotifications?.chatChanged();$('chat-app').dataset.panel='conversation';clearReply();$('send-status').textContent='';source=crypto.randomUUID();lastText='';generation++;messages=[];$('text').value='';$('compose').hidden=mode==='dms';$('dm-note').hidden=mode!=='dms';$('title').textContent=group.name;$('refresh').disabled=false;$('text').disabled=false;$('send').disabled=false;restoreDraft();$('find-messages').disabled=false;$('chat-empty').hidden=true;clearMessageSearch();resetNewMessages();renderGroups();loadMessages()};$('groups').append(button)}}
async function loadGroups(more=false,quiet=false){
 if(busy)return false;listing++;const listMode=mode;$('refresh-groups').disabled=true;$('more-groups').disabled=true;$('refresh-groups').textContent='Connecting…';$('status').dataset.error='false';
 if(!quiet)status('Checking your saved GroupMe account…');
 try{
  if(!quiet){const account=await api('status');connected=true;ownerId=String(account.id);$('account').textContent='Connected as '+account.name;status('Connected. Loading conversations…')}
  const next=more?page+1:1,data=await api((mode==='dms'?'chats':'groups')+'?page='+next);if(listMode!==mode)return;if(!Array.isArray(data))throw Error('GroupMe returned an unexpected group list.');
  const entries=listMode==='dms'?data.filter(chat=>chat.other_user?.id).map(chat=>({id:String(chat.other_user.id),name:chat.other_user.name||'GroupMe user'})):data;
  groups=(more||quiet)?[...new Map([...groups,...entries].map(g=>[String(g.id),{...g,id:String(g.id)}])).values()]:entries.map(g=>({...g,id:String(g.id)}));initializeReadCounts(groups);if(!quiet)page=next;lastList=Date.now();
  if(!quiet)$('more-groups').hidden=data.length<100;renderGroups();markRead();if(!quiet)status(groups.length?`${groups.length} ${mode==='dms'?'direct conversations':'groups'} loaded. Select one to read messages.`:`Connected successfully. No ${mode==='dms'?'direct conversations':'groups'} found.`);$('setup').hidden=true;
  if(initialChat&&!quiet){const[kind,id]=initialChat.split(':');if(kind!==mode){mode=kind;$('list-title').textContent=kind==='dms'?'Direct messages':'Groups';$('tab-groups').setAttribute('aria-pressed',String(kind==='groups'));$('tab-dms').setAttribute('aria-pressed',String(kind==='dms'));return loadGroups()}
   initialChat=null;const target=groups.find(g=>g.id===id)||{id,name:'GroupMe conversation'};current=target;$('chat-app').dataset.panel='conversation';$('title').textContent=target.name;$('compose').hidden=kind==='dms';$('dm-note').hidden=kind!=='dms';$('text').disabled=false;$('send').disabled=false;window.DockGroupMeNotifications?.chatChanged();restoreDraft();$('chat-empty').hidden=true;$('find-messages').disabled=false;loadMessages();
  }return true;
 }catch(e){if(listMode!==mode)return;$('status').dataset.error='true';status(e.message);$('setup').hidden=false;return false}
 finally{listing--;if(listMode===mode){$('refresh-groups').disabled=false;$('refresh-groups').textContent='Connect / refresh';$('more-groups').disabled=false}}
}
function renderMessages(){const root=$('messages');root.replaceChildren();let lastDay='';const visible=[...messages].filter(m=>!deletedMessages.has(current?.id+':'+m.id)&&matchesMessage(m));$('message-search-count').textContent=messageQuery?visible.length+' matching loaded messages':'';for(const message of visible.sort((a,b)=>a.created_at-b.created_at)){const day=messageDay(message.created_at);if(day!==lastDay){lastDay=day;const separator=document.createElement('div');separator.className='message-day';separator.textContent=day;root.append(separator)}const row=document.createElement('article');row.className='message';row.dataset.own=String(String(message.user_id)===ownerId);const header=document.createElement('header'),name=document.createElement('strong'),time=document.createElement('time');name.textContent=message.name||'Group member';const date=new Date(message.created_at*1000);time.textContent=Number.isNaN(date.valueOf())?'':messageTime.format(date);time.title=Number.isNaN(date.valueOf())?'':date.toLocaleString();header.append(name,time);const text=document.createElement('p');text.textContent=message.text||'';text.className=displayPrefs.emoji&&isEmojiOnly(message.text)?'emoji-only':'';row.append(header,text);if(message.attachments?.length){const note=document.createElement('small');note.textContent='Attachments · view them in GroupMe';row.append(note)}if(mode==='groups'){
 const actions=document.createElement('div');actions.className='message-actions';const favorites=Array.isArray(message.favorited_by)?message.favorited_by.map(String):[],liked=favorites.includes(ownerId)||!!message.dock_reaction;
 const heart=document.createElement('button');heart.type='button';heart.textContent=(message.dock_reaction||(liked?'♥':'♡'))+' '+Math.max(favorites.length,message.dock_reaction?1:0);heart.setAttribute('aria-label',liked?'Remove heart reaction':'React with a heart');heart.setAttribute('aria-pressed',String(liked));heart.onclick=()=>reactToMessage(message,liked);
 const reply=document.createElement('button');reply.type='button';reply.textContent='Reply';reply.onclick=()=>{if(busy)return;replyTarget={id:message.id,name:message.name||'Member',text:message.text||'[Attachment]'};$('reply-bar').hidden=false;$('reply-preview').textContent='Quoted reply to '+replyTarget.name+': '+replyTarget.text.slice(0,120);$('text').maxLength=1000-replyPrefix().length;saveDraft();$('text').focus()};const picker=document.createElement('button');picker.type='button';picker.textContent='React';picker.setAttribute('aria-label','Choose a reaction emoji');picker.onclick=()=>openReactions(message);actions.append(heart,reply,picker);
 if(ownerId&&String(message.user_id)===ownerId){const trash=document.createElement('button');trash.type='button';trash.textContent='Delete';trash.setAttribute('aria-label','Delete your message');trash.onclick=()=>deleteMessage(message);actions.append(trash)}row.append(actions)
 }root.append(row)}if(!visible.length)root.textContent=messageQuery?'No matching loaded messages. Load earlier messages to search more.':'No messages yet.'}
async function loadMessages(older=false,live=false){
 if(!current)return false;reading++;const id=current.id,conversationMode=mode,version=++generation;
 if(!live){$('refresh').disabled=true;$('older').disabled=true;status('Loading messages…')}
 try{
  const before=older?messages.reduce((old,m)=>!old||m.created_at<old.created_at?m:old,null)?.id:null;
  const data=await api((conversationMode==='dms'?'direct-messages?user=':'messages?group=')+encodeURIComponent(id)+(before?'&before='+encodeURIComponent(before):''));
  if(version!==generation)return false;
  const incoming=(conversationMode==='dms'?data.direct_messages:data.messages)||[];
  const root=$('messages'),top=root.scrollTop||0,nearBottom=(root.scrollHeight||0)-top-(root.clientHeight||0)<80;
  const known=new Map(messages.map(m=>[String(m.id),m]));const fresh=incoming.filter(m=>!known.has(String(m.id)));const next=(older||live)?[...new Map([...messages,...incoming.map(m=>({...known.get(String(m.id)),...m}))].map(m=>[String(m.id),m])).values()]:incoming;
  if(JSON.stringify(next)!==JSON.stringify(messages)||!root.children.length){const oldHeight=root.scrollHeight||0;messages=next;renderMessages();root.scrollTop=older?top+Math.max(0,(root.scrollHeight||0)-oldHeight):live&&!nearBottom?top:root.scrollHeight}
  if(live&&!nearBottom&&fresh.length){newMessageCount+=fresh.length;$('new-messages').hidden=false;$('new-messages').textContent=newMessageCount+' new messages · Jump to latest'}else if(nearBottom&&!messageQuery)resetNewMessages();
  if(!live){$('older').hidden=incoming.length<40;status('Updated '+new Date().toLocaleTimeString());if(!older)root.scrollTop=root.scrollHeight}
  if(!older)markRead();
  if(live&&$('status').dataset.error==='true'){status('Reconnected · messages are updating automatically.');$('status').dataset.error='false'}
  return true;
 }catch(e){if(version===generation){status(e.message);$('status').dataset.error='true'}return false}
 finally{reading--;if(version===generation&&!live){$('refresh').disabled=false;$('older').disabled=false}}
}
$('text').onkeydown=event=>{
 if(event.key!=='Enter'||event.shiftKey||event.isComposing||event.keyCode===229)return;
 event.preventDefault();
 if(event.repeat||busy||!current||mode==='dms'||!$('text').value.trim()||$('send').disabled)return;
 keyboardSend=true;try{$('compose').requestSubmit()}finally{keyboardSend=false}
};
$('compose').onsubmit=async event=>{
 event.preventDefault();const restoreFocus=keyboardSend;if(mode==='dms'){$('send-status').textContent='DMs are read-only because GroupMe does not allow DM sending through its Developer API.';return}const draft=$('text').value.trim(),text=replyPrefix()+draft;if(!draft||!current||busy)return;if(text.length>1000){$('send-status').textContent='Shorten your reply to fit the 1,000 character message limit.';return}
 if(text!==lastText){source=crypto.randomUUID();lastText=text}
 busy=true;$('send').disabled=true;$('text').disabled=true;$('send-status').textContent='Sending…';
 try{
  await api('send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({group:String(current.id),text,source})});
  $('text').value='';clearReply();source=crypto.randomUUID();lastText='';saveDraft();$('send-status').textContent='Sent.';
  const refreshed=await loadMessages();if(!refreshed)$('send-status').textContent='Sent. Conversation refresh failed; use Refresh to check for updates. Do not resend.';
 }catch(e){saveDraft();$('send-status').textContent=e.message+' Your draft is still here. No automatic resend was attempted.'}
 finally{busy=false;$('send').disabled=false;$('text').disabled=false;const focus=document.activeElement;if(restoreFocus&&document.visibilityState==='visible'&&$('chat-app').dataset.panel==='conversation'&&!document.querySelector?.('dialog[open]')&&(!focus||focus===document.body||focus===$('text')||focus===$('send')))$('text').focus({preventScroll:true})}
};
function switchMode(next){
 if(busy||mode===next)return;
 saveDraft();mode=next;$('chat-app').dataset.panel='list';clearReply();$('dm-note').hidden=mode!=='dms';$('send-status').textContent='';generation++;current=null;messages=[];groups=[];page=1;$('text').value='';$('compose').hidden=true;$('messages').replaceChildren();$('chat-empty').hidden=false;$('find-messages').disabled=true;clearMessageSearch();resetNewMessages();$('title').textContent='Choose a conversation';$('refresh').disabled=true;$('older').hidden=true;$('more-groups').hidden=true;$('search').value='';$('list-title').textContent=mode==='dms'?'Direct messages':'Groups';
 $('tab-groups').setAttribute('aria-pressed',String(mode==='groups'));$('tab-dms').setAttribute('aria-pressed',String(mode==='dms'));renderGroups();window.DockGroupMeNotifications?.chatChanged();loadGroups();
}
$('tab-groups').onclick=()=>switchMode('groups');$('tab-dms').onclick=()=>switchMode('dms');
const DISPLAY_KEY='dock-groupme-display-v1',READ_KEY='dock-groupme-read-v1',DRAFT_KEY='dock-groupme-drafts-v1';
const displayDefaults={density:'comfortable',layout:'bubbles',width:'focused',emoji:true,interval:5};
function readObject(key,storage=localStorage){try{const value=JSON.parse(storage.getItem(key)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return {}}}
function normalizeDisplay(value){return {density:value.density==='compact'?'compact':'comfortable',layout:value.layout==='flat'?'flat':'bubbles',width:value.width==='wide'?'wide':'focused',emoji:value.emoji!==false,interval:Number.isFinite(Number(value.interval))?Math.max(1,Math.min(300,Math.round(Number(value.interval)))):5}}
let displayPrefs=normalizeDisplay(readObject(DISPLAY_KEY)),readState=readObject(READ_KEY),drafts={};
try{drafts=readObject(DRAFT_KEY,sessionStorage)}catch{}
const messageTime=new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'});
function messageDay(seconds){const date=new Date(seconds*1000);if(Number.isNaN(date.valueOf()))return 'Unknown date';const now=new Date(),yesterday=new Date();yesterday.setDate(now.getDate()-1);return date.toDateString()===now.toDateString()?'Today':date.toDateString()===yesterday.toDateString()?'Yesterday':date.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',...(date.getFullYear()!==now.getFullYear()?{year:'numeric'}:{})})}
function applyDisplay(){for(const key of ['density','layout','width']){$('chat-app').dataset[key]=displayPrefs[key];$('display-'+key).value=displayPrefs[key]}$('display-emoji').checked=displayPrefs.emoji;$('refresh-interval').value=String(displayPrefs.interval);$('live-status').textContent='Live · checks every '+displayPrefs.interval+' sec'}
function saveDisplay(){try{localStorage.setItem(DISPLAY_KEY,JSON.stringify(displayPrefs))}catch{status('Settings applied for this session; browser storage is unavailable.')}applyDisplay();const top=$('messages').scrollTop;renderMessages();$('messages').scrollTop=top}
function initDisplay(){applyDisplay();$('display-settings').onclick=()=>$('display-dialog').showModal();$('display-close').onclick=()=>$('display-dialog').close();for(const key of ['density','layout','width'])$('display-'+key).onchange=()=>{displayPrefs[key]=$('display-'+key).value;saveDisplay()};$('display-emoji').onchange=()=>{displayPrefs.emoji=$('display-emoji').checked;saveDisplay()};$('refresh-interval').onchange=()=>{const value=Number($('refresh-interval').value);if(!Number.isInteger(value)||value<1||value>300){$('interval-status').textContent='Choose a whole number from 1 to 300 seconds.';return}displayPrefs.interval=value;liveDelay=value*1000;saveDisplay();$('interval-status').textContent='Saved. Active chats and conversation badges check every '+value+' seconds while this page is visible.';scheduleLive(liveDelay)};$('display-reset').onclick=()=>{displayPrefs={...displayDefaults};applyTextSize(14);try{localStorage.setItem(TEXT_SIZE_KEY,'14')}catch{}saveDisplay();liveDelay=5000;scheduleLive()}}
function draftKey(){return mode+':'+current?.id}
function saveDraft(){if(!current||mode!=='groups'){$('draft-status').textContent='';return}const key=draftKey(),text=$('text').value.slice(0,1000);if(text||replyTarget)drafts[key]={text,reply:replyTarget,source,lastText,at:Date.now()};else delete drafts[key];const sorted=Object.entries(drafts).filter(([,d])=>d&&Date.now()-d.at<86400000).sort((a,b)=>b[1].at-a[1].at).slice(0,30);drafts=Object.fromEntries(sorted);let saved=true;try{sessionStorage.setItem(DRAFT_KEY,JSON.stringify(drafts))}catch{saved=false}$('draft-status').textContent=text||replyTarget?(saved?'Draft saved in this tab':'Draft kept for this session'):''}
function restoreDraft(){const d=drafts[draftKey()];$('draft-status').textContent='';if(mode!=='groups'||!d||Date.now()-d.at>86400000)return;$('text').value=typeof d.text==='string'?d.text.slice(0,1000):'';replyTarget=d.reply&&typeof d.reply.name==='string'&&typeof d.reply.text==='string'?{id:d.reply.id,name:d.reply.name.slice(0,60),text:d.reply.text.slice(0,250)}:null;source=typeof d.source==='string'?d.source:crypto.randomUUID();lastText=typeof d.lastText==='string'?d.lastText:'';if(replyTarget){$('reply-bar').hidden=false;$('reply-preview').textContent='Quoted reply to '+replyTarget.name+': '+replyTarget.text.slice(0,120);$('text').maxLength=1000-replyPrefix().length}saveDraft()}
function matchesMessage(message){return !messageQuery||((message.name||'')+' '+(message.text||'')).toLocaleLowerCase().includes(messageQuery)}
function clearMessageSearch() {messageQuery='';$('message-search').value='';$('message-search-bar').hidden=true;$('find-messages').setAttribute('aria-expanded','false');$('message-search-count').textContent=''}
function resetNewMessages(){newMessageCount=0;$('new-messages').hidden=true}
function conversationVisible(){return document.visibilityState==='visible'&&($('chat-app').dataset.panel==='conversation'||!window.matchMedia||window.matchMedia('(min-width:651px)').matches)}
function nearLatest(){const root=$('messages');return (root.scrollHeight||0)-(root.scrollTop||0)-(root.clientHeight||0)<80}
function countFor(group){const count=Number(group.messages?.count);return mode==='groups'&&group.messages?.count!==undefined&&Number.isSafeInteger(count)&&count>=0?count:null}
function persistRead(){try{localStorage.setItem(READ_KEY,JSON.stringify(readState))}catch{}}
function initializeReadCounts(entries){let changed=false;for(const group of entries){const count=countFor(group),key=mode+':'+group.id;if(count!==null&&(!Number.isSafeInteger(readState[key]?.count)||count<readState[key].count)){readState[key]={count,at:Date.now()};changed=true}}if(changed)persistRead()}
function unreadCount(group){const count=countFor(group),seen=readState[mode+':'+group.id]?.count;return count!==null&&Number.isSafeInteger(seen)?Math.max(0,count-seen):0}
function markRead(){if(!current||!conversationVisible()||!nearLatest()||messageQuery)return;const group=groups.find(g=>g.id===current.id),count=group&&countFor(group);if(count===null||count===undefined)return;const latest=group.messages?.last_message_id;if(latest&&!messages.some(m=>String(m.id)===String(latest)))return;const key=mode+':'+current.id;if(readState[key]?.count!==count){readState[key]={count,at:Date.now()};persistRead();renderGroups()}}

initDisplay();
$('search').oninput=renderGroups;$('refresh-groups').onclick=()=>loadGroups();$('more-groups').onclick=()=>loadGroups(true);$('refresh').onclick=()=>loadMessages();$('older').onclick=()=>loadMessages(true);$('theme').onclick=()=>DockAppearance.toggleTheme();window.addEventListener('beforeunload',e=>{if($('text').value){e.preventDefault();e.returnValue=''}});loadGroups();

function scheduleLive(delay=displayPrefs.interval*1000){clearTimeout(liveTimer);if(!stopped)liveTimer=setTimeout(pollLive,delay)}
async function pollLive(){
 if(stopped)return;
 if(document.visibilityState!=='visible'||navigator.onLine===false){$('live-status').textContent='Live updates paused';scheduleLive();return}
 if(Date.now()<retryAt){$('live-status').textContent='Live updates waiting · rate limit';scheduleLive(Math.max(5000,retryAt-Date.now()));return}
 if(busy||reading||listing||Date.now()-lastAttempt<displayPrefs.interval*1000-100){scheduleLive();return}
 lastAttempt=Date.now();let ok=true;
 try{
  if(!connected)ok=await loadGroups();
  else{
   if(current)ok=await loadMessages(false,true);
   if(ok&&Date.now()-lastList>=displayPrefs.interval*1000-100&&Date.now()>=retryAt)ok=await loadGroups(false,true);
  }
 }finally{
  liveDelay=ok?displayPrefs.interval*1000:Math.min(300000,Math.max(displayPrefs.interval*1000,liveDelay*2));
  $('live-status').textContent=ok?'Live · checks every '+displayPrefs.interval+' sec':'Live updates retrying…';scheduleLive(liveDelay);
 }
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleLive(0)});
window.addEventListener('online',()=>scheduleLive(0));window.addEventListener('pagehide',()=>{saveDraft();stopped=true;clearTimeout(liveTimer)});window.addEventListener('pageshow',()=>{stopped=false;scheduleLive()});scheduleLive();

function replyPrefix(){return replyTarget?'> '+replyTarget.name.slice(0,60)+': '+replyTarget.text.slice(0,250).replace(/\n/g,'\n> ')+'\n\n':''}
function clearReply(){replyTarget=null;$('reply-bar').hidden=true;$('text').maxLength=1000}
$('cancel-reply').onclick=()=>{clearReply();saveDraft()};
const REACTION_EMOJI=['❤️','👍','🤣','🎉','🔥','😮','👀','😭','🥺','🙏','💀','🫶','🤬','💅','🫠'];
let reactionMessage=null;
function openReactions(message){if(busy)return;reactionMessage=message;const root=$('reaction-options');root.replaceChildren();for(const emoji of REACTION_EMOJI){const button=document.createElement('button');button.type='button';button.textContent=emoji;const selected=message.dock_reaction||(Array.isArray(message.favorited_by)&&message.favorited_by.map(String).includes(ownerId)?'❤️':null);button.setAttribute('aria-label','React '+emoji);button.setAttribute('aria-pressed',String(selected===emoji));button.onclick=()=>{$('reaction-dialog').close();reactToMessage(reactionMessage,selected===emoji,emoji)};root.append(button)}$('reaction-dialog').showModal()}
$('reaction-close').onclick=()=>$('reaction-dialog').close();
async function reactToMessage(message,liked,emoji='❤️'){
 if(busy||mode!=='groups'||!current||!message)return;busy=true;const id=current.id;
 try{const result=await api('react',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({group:id,message:String(message.id),liked:!liked,emoji})});
  if(result?.confirmed!==true||String(result.message_id)!==String(message.id))throw Error('The server did not confirm this GroupMe reaction.');
  const confirmedEmoji=result.emoji===undefined?(!liked?'❤️':null):result.emoji;
  messages=messages.map(m=>String(m.id)===String(message.id)?{...m,...(Array.isArray(result.favorited_by)?{favorited_by:result.favorited_by}:{}),dock_reaction:confirmedEmoji}:m);
  const top=$('messages').scrollTop;renderMessages();$('messages').scrollTop=top;status(confirmedEmoji?'Reaction '+confirmedEmoji+' confirmed by GroupMe.':'Reaction removal confirmed by GroupMe.');
 }catch(e){status(e.message)}finally{busy=false}
}

async function deleteMessage(message){
 if(busy||mode!=='groups'||!current||String(message.user_id)!==ownerId)return;
 if(!confirm('Delete this message from GroupMe? This cannot be undone.'))return;busy=true;const group=current.id;
 try{await api('delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({group,message:String(message.id)})});deletedMessages.add(group+':'+message.id);if(replyTarget?.id===message.id){clearReply();saveDraft()}renderMessages();status('Message deleted from GroupMe.')}
 catch(e){status(e.message+' Nothing was removed from this view.')}finally{busy=false}
}

loadTextSize();
$('text-size').oninput=()=>{const size=normalizedTextSize($('text-size').value);applyTextSize(size);try{localStorage.setItem(TEXT_SIZE_KEY,String(size))}catch{status('Text size changed for this session; browser storage is unavailable.')}};
window.addEventListener('storage',event=>{if(event.key===TEXT_SIZE_KEY||event.key===null)loadTextSize()});

$('conversation-back').onclick=()=>{saveDraft();$('chat-app').dataset.panel='list';$('list-title').focus({preventScroll:true})};
function fitChatViewport(){if(window.visualViewport)$('chat-app').style.setProperty('--chat-viewport-height',Math.round(window.visualViewport.height)+'px')}
window.visualViewport?.addEventListener('resize',fitChatViewport);window.addEventListener('resize',fitChatViewport);fitChatViewport();

window.DockGroupMeChat={getCurrent:()=>current?{kind:mode,id:current.id,name:current.name}:null};

$('text').oninput=saveDraft;
$('find-messages').onclick=()=>{const open=$('message-search-bar').hidden;$('message-search-bar').hidden=!open;$('find-messages').setAttribute('aria-expanded',String(open));if(open)$('message-search').focus();else{clearMessageSearch();renderMessages()}};
$('message-search').oninput=()=>{messageQuery=$('message-search').value.trim().toLocaleLowerCase();renderMessages()};
$('close-message-search').onclick=()=>{clearMessageSearch();renderMessages();$('find-messages').focus()};
$('message-search').onkeydown=e=>{if(e.key==='Escape')$('close-message-search').onclick()};
$('new-messages').onclick=()=>{if(messageQuery){clearMessageSearch();renderMessages()}$('messages').scrollTop=$('messages').scrollHeight;resetNewMessages();markRead()};
$('messages').onscroll=()=>{if(nearLatest()){resetNewMessages();markRead()}};
window.addEventListener('storage',event=>{if(event.key===DISPLAY_KEY||event.key===null){displayPrefs=normalizeDisplay(readObject(DISPLAY_KEY));applyDisplay();renderMessages();liveDelay=displayPrefs.interval*1000;scheduleLive()}if(event.key===READ_KEY||event.key===null){readState=readObject(READ_KEY);renderGroups()}});
