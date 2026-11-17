// Real group events and a clearly labelled local composer indicator. No API token in JS.
const indicator=document.getElementById('typing-indicator'),label=document.getElementById('typing-label'),connection=document.getElementById('typing-connection');
let revision=0,controller,clientId=null,sequence=0,retryTimer,expiryTimer,activeGroup=null,localUntil=0,previewUntil=0,people=new Map();
function render(){
 const now=Date.now();for(const[id,person]of people)if(person.until<=now)people.delete(id);
 const names=[...people.values()].map(p=>p.name),local=localUntil>now,preview=previewUntil>now;
 indicator.hidden=!names.length&&!local&&!preview;
 label.textContent=preview?'Typing indicator preview':names.length>2?'Several people are typing…':names.length===2?names.join(' and ')+' are typing…':names.length?names[0]+' is typing…':local?'You are typing…':'';
 clearTimeout(expiryTimer);if(!indicator.hidden)expiryTimer=setTimeout(render,250);
}
async function api(action,session,group,signal){
 const response=await fetch('/api/groupme/live',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,clientId:session,group,sequence:++sequence}),signal:AbortSignal.any([signal,AbortSignal.timeout(35000)])});
 if(!response.ok)throw Error(response.status===429?'Typing rate limited':'Typing connection unavailable');
 const data=await response.json();if(!Array.isArray(data.events))throw Error('Typing response unavailable');return data.events;
}
function stop(){
 revision++;activeGroup=null;clearTimeout(retryTimer);clearTimeout(expiryTimer);controller?.abort();controller=null;
 if(clientId){fetch('/api/groupme/live',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'disconnect',clientId,sequence:++sequence}),keepalive:true}).catch(()=>{});clientId=null}
 people.clear();localUntil=0;previewUntil=0;render();
}
function selected(){const app=window.DockGroupMeChat,chat=app?.getCurrent();return chat?.kind==='groups'&&app.isVisible()&&document.visibilityState==='visible'&&navigator.onLine!==false?chat:null}
async function start(){
 const chat=selected();if(chat&&activeGroup===chat.id&&controller&&!controller.signal.aborted)return;
 stop();if(!chat){connection.textContent='Other people’s typing connects in visible group chats.';return}
 activeGroup=chat.id;connection.textContent='Connecting group typing indicators…';controller=new AbortController();const signal=controller.signal,version=revision;
 const retry=()=>{if(version!==revision)return;stop();connection.textContent='Group typing unavailable · retrying in 30 sec. Your own typing preview still works.';retryTimer=setTimeout(start,30000)};
 try{
  const handshake=await api('handshake',null,null,signal);if(version!==revision)return;
  const meta=handshake.find(e=>e.channel==='/meta/handshake');if(!meta?.successful||!meta.clientId)throw Error();clientId=meta.clientId;
  const subscribed=await api('subscribe',clientId,chat.id,signal);if(version!==revision)return;if(!subscribed.some(e=>e.channel==='/meta/subscribe'&&e.successful))throw Error();
  connection.textContent='Group typing connected · dots appear when another member types.';
  async function poll(){
   if(version!==revision||selected()?.id!==chat.id)return;
   try{
    const events=await api('connect',clientId,null,signal);if(version!==revision)return;let delay=100;
    for(const event of events){
     if(event.channel==='/meta/connect'){if(!event.successful||event.reconnect==='handshake'||event.reconnect==='none')throw Error();delay=Math.max(delay,event.interval||0)}
     else if(event.channel==='/group/'+chat.id&&event.type==='typing'&&event.userId!==window.DockGroupMeChat.getOwner())people.set(event.userId,{name:window.DockGroupMeChat.getMemberName(event.userId)||event.name||'A group member',until:Date.now()+1500});
    }
    render();retryTimer=setTimeout(poll,delay);
   }catch{retry()}
  }
  poll();
 }catch{retry()}
}
window.DockGroupMeTyping={chatChanged:start,draftChanged:()=>{localUntil=document.getElementById('text').value.trim()&&window.DockGroupMeChat?.getCurrent()?.kind==='groups'?Date.now()+1500:0;render()},preview:()=>{previewUntil=Date.now()+3000;render()}};
const preview=document.getElementById('typing-preview');if(preview)preview.onclick=()=>{const app=window.DockGroupMeChat;if(!app?.getCurrent()||!app.isVisible()){document.getElementById('typing-preview-status').textContent='Open a group chat first to preview the dots below its messages.';return}document.getElementById('typing-preview-status').textContent='';document.getElementById('display-dialog').close();window.DockGroupMeTyping.preview()};
document.addEventListener('visibilitychange',start);window.addEventListener('online',start);window.addEventListener('offline',stop);window.addEventListener('pagehide',stop);window.addEventListener('pageshow',start);start();
