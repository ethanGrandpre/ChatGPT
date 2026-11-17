// Receive actual group typing events through the private server; no token in JS.
const indicator=document.getElementById('typing-indicator'),label=document.getElementById('typing-label'),connection=document.getElementById('typing-connection');
let revision=0,controller,clientId=null,sequence=0,retryTimer,expiryTimer,people=new Map();
function render(){const now=Date.now();for(const[id,person]of people)if(person.until<=now)people.delete(id);const names=[...people.values()].map(p=>p.name);indicator.hidden=!names.length;label.textContent=names.length>2?'Several people are typing…':names.length===2?names.join(' and ')+' are typing…':names.length?names[0]+' is typing…':'';clearTimeout(expiryTimer);if(names.length)expiryTimer=setTimeout(render,500)}
async function api(action,session,group,signal){const response=await fetch('/api/groupme/live',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,clientId:session,group,sequence:++sequence}),signal:AbortSignal.any([signal,AbortSignal.timeout(35000)])});if(!response.ok)throw Error('Typing connection unavailable');const data=await response.json();if(!Array.isArray(data.events))throw Error('Typing response unavailable');return data.events}
function stop(){revision++;clearTimeout(retryTimer);clearTimeout(expiryTimer);controller?.abort();controller=null;if(clientId){fetch('/api/groupme/live',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'disconnect',clientId,sequence:++sequence}),keepalive:true}).catch(()=>{});clientId=null}people.clear();render()}
function selected(){const app=window.DockGroupMeChat,chat=app?.getCurrent();return chat?.kind==='groups'&&app.isVisible()&&document.visibilityState==='visible'&&navigator.onLine!==false?chat:null}
async function start(){
 stop();const chat=selected();if(!chat){connection.textContent='Typing indicators connect in visible group chats.';return}connection.textContent='Connecting group typing indicators…';controller=new AbortController();const signal=controller.signal,version=revision;
 try{
  const handshake=await api('handshake',null,null,signal);if(version!==revision)return;const meta=handshake.find(e=>e.channel==='/meta/handshake');if(!meta?.successful||!meta.clientId)throw Error();clientId=meta.clientId;
  const subscribed=await api('subscribe',clientId,chat.id,signal);if(version!==revision)return;if(!subscribed.some(e=>e.channel==='/meta/subscribe'&&e.successful))throw Error();
  connection.textContent='Group typing indicators connected.';
  async function poll(){
   if(version!==revision||!selected())return;
   try{const events=await api('connect',clientId,null,signal);if(version!==revision)return;let delay=500;
    for(const event of events){if(event.channel==='/meta/connect'){if(!event.successful||event.reconnect==='handshake'||event.reconnect==='none')throw Error();delay=Math.max(delay,event.interval||0)}else if(event.channel==='/group/'+chat.id&&event.type==='typing'&&event.userId!==window.DockGroupMeChat.getOwner()){people.set(event.userId,{name:window.DockGroupMeChat.getMemberName(event.userId)||event.name||'A group member',until:Date.now()+4000})}}
    render();retryTimer=setTimeout(poll,delay);
   }catch{if(version===revision){stop();connection.textContent='Typing indicators reconnecting · messages still refresh.';retryTimer=setTimeout(start,30000)}}
  }
  poll();
 }catch{if(version===revision){stop();connection.textContent='Typing indicators reconnecting · messages still refresh.';retryTimer=setTimeout(start,30000)}}
}
window.DockGroupMeTyping={chatChanged:start};document.addEventListener('visibilitychange',start);window.addEventListener('online',start);window.addEventListener('offline',stop);window.addEventListener('pagehide',stop);window.addEventListener('pageshow',start);start();
