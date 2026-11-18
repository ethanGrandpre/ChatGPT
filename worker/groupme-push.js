import {TaskPush,pushEndpoint} from './task-push.js';
import {groupme} from './groupme.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const validDevice=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/i.test(id);
const validChat=value=>value&&['groups','dms'].includes(value.kind)&&/^\d{1,30}$/.test(value.id||'');
const keyOf=chat=>chat.kind+':'+chat.id;
const INTERVAL=30000;
export class GroupMePush extends TaskPush{
 async init(){this.state=await this.ctx.storage.get('groupme-state')||{devices:{},chats:{},nextPoll:0,lastError:null};this.devices=this.state.devices;this.keys=await this.ctx.storage.get('keys')||null;this.tokens=await this.ctx.storage.get('tokens')||{};}
 async persist(){const now=Date.now(),times=[];for(const d of Object.values(this.devices)){d.pending=d.pending.filter(e=>e.at>now-86400000);if(d.testAt)times.push(d.testAt);if(d.needsPush)times.push(now+INTERVAL);for(const e of d.pending)times.push(e.at+86400000)}this.state.devices=this.devices;await this.ctx.storage.put('groupme-state',this.state);if(Object.keys(this.devices).length&&Object.keys(this.state.chats).length)times.push(this.state.nextPoll||now+INTERVAL);if(times.length)await this.ctx.storage.setAlarm(Math.max(now+1000,Math.min(...times)));else await this.ctx.storage.deleteAlarm()}

 async read(action){const response=await groupme(new Request('https://internal/api/groupme/'+action),this.env,this.networkFetch);const data=await response.json();if(!response.ok)throw Error(data.error||'GroupMe is unavailable.');return data.response}
 async history(chat){const data=await this.read((chat.kind==='groups'?'messages?group=':'direct-messages?user=')+chat.id);return (chat.kind==='groups'?data.messages:data.direct_messages)||[]}
 async push(device){let code;try{code=await this.deliver(device)}catch{code=0}if(code===404||code===410)return'expired';if(code>=200&&code<300){device.needsPush=false;device.attempts=0;device.lastAccepted=Date.now();return'accepted'}device.attempts=(device.attempts||0)+1;if(device.attempts>=3){device.needsPush=false;device.attempts=0}return'failed'}
 fetch(request){return this.run(async()=>{try{
  const url=new URL(request.url),deviceId=url.searchParams.get('deviceId');
  if(request.method==='GET'){
   if(url.searchParams.get('events')==='1'){if(!validDevice(deviceId))return json({error:'Invalid device.'},400);return json({quiet:Object.values(this.devices[deviceId]?.active||{}).some(value=>value.until>Date.now()),events:(this.devices[deviceId]?.pending||[]).filter(e=>e.at>Date.now()-86400000).map(e=>this.state.previews===false?{...e,name:'GroupMe',body:'New message',count:0}:e)})}
   const keys=await this.ensureKeys();return json({previews:this.state.previews!==false,publicKey:keys.publicKey,subscribed:!!this.devices[deviceId],chats:Object.keys(this.state.chats),lastError:this.state.lastError,lastChecked:this.state.lastChecked||null});
  }
  if(request.method!=='POST')return json({error:'Method not allowed.'},405);
  const raw=await request.text();if(raw.length>20000)return json({error:'Request too large.'},413);const data=JSON.parse(raw);
  if(!validDevice(data.deviceId))return json({error:'Invalid device.'},400);const id=data.deviceId;
  if(data.action==='privacy'){if(typeof data.previews!=='boolean')return json({error:'Invalid privacy preference.'},400);this.state.previews=data.previews;await this.persist();return json({previews:this.state.previews})}
  if(data.action==='subscribe'){
   const endpoint=pushEndpoint(data.subscription?.endpoint||'');if(!this.devices[id]&&Object.keys(this.devices).length>=12)return json({error:'Disable an unused device before adding another.'},400);
   this.devices[id]={...this.devices[id],endpoint,topic:'dock-groupme',pending:this.devices[id]?.pending||[],needsPush:false};await this.ensureKeys();await this.persist();return json({subscribed:true});
  }
  if(data.action==='disable'){delete this.devices[id];await this.persist();return json({subscribed:false})}
  const device=this.devices[id];if(!device&&!(data.action==='watch'&&data.enabled===false))return json({error:'Enable notifications on this device first.',code:'subscription_missing'},409);
  if(data.action==='presence'){
   if(!validDevice(data.tab)||data.chat!==null&&!validChat(data.chat))return json({error:'Invalid presence.'},400);
   const now=Date.now();device.active=Object.fromEntries(Object.entries(device.active||{}).filter(([key,value])=>value.until>now&&key!==data.tab));if(data.chat){device.active[data.tab]={chat:keyOf(data.chat),until:now+45000};device.active=Object.fromEntries(Object.entries(device.active).slice(-10));device.pending=device.pending.filter(e=>e.chat!==keyOf(data.chat));device.needsPush=device.needsPush&&device.pending.length>0}await this.persist();return json({ok:true})
  }
  if(data.action==='test-delayed'){if(Date.now()-(device.lastTest||0)<30000)return json({error:'Wait 30 seconds between tests.'},429);device.lastTest=Date.now();device.testAt=Date.now()+10000;await this.persist();return json({scheduled:true,at:device.testAt})}
  if(data.action==='watch'){
   if(!validChat(data.chat)||typeof data.enabled!=='boolean')return json({error:'Invalid chat.'},400);const key=keyOf(data.chat);
   if(data.enabled){
    if(!this.state.chats[key]&&Object.keys(this.state.chats).length>=10)return json({error:'Notifications support up to 10 chats. Turn one off first.'},400);
    // Seed a cursor before enabling: never notify for old history.
    const startedAt=Date.now();const[account,messages]=await Promise.all([this.read('status'),this.history(data.chat)]);
    this.state.accountId=String(account.id);this.state.chats[key]={kind:data.chat.kind,id:String(data.chat.id),name:String(data.chat.name||'GroupMe').slice(0,100),since:startedAt,seen:messages.map(m=>String(m.id)).slice(0,200)};
   }else{delete this.state.chats[key];for(const d of Object.values(this.devices)){d.pending=d.pending.filter(e=>e.chat!==key);d.needsPush=d.needsPush&&d.pending.length>0}}
   this.state.nextPoll=Math.min(this.state.nextPoll||Infinity,Date.now()+INTERVAL);await this.persist();return json({enabled:data.enabled,chats:Object.keys(this.state.chats)});
  }
  if(data.action==='ack'){
   const ids=new Set(Array.isArray(data.ids)?data.ids.filter(x=>typeof x==='string').slice(0,50):[]);device.pending=device.pending.filter(e=>!ids.has(e.id));await this.persist();return json({ok:true});
  }
  if(data.action==='test'){
   if(Date.now()-(device.lastTest||0)<30000)return json({error:'Wait 30 seconds between test notifications.'},429);
   device.lastTest=Date.now();device.pending.push({id:crypto.randomUUID(),chat:'test',name:'GroupMe test',body:'Notifications are connected on this device.',at:Date.now()});device.pending=device.pending.slice(-30);device.needsPush=true;
   const result=await this.push(device);if(result==='expired')delete this.devices[id];await this.persist();return result==='accepted'?json({accepted:true}):json({error:result==='expired'?'Subscription expired. Enable this device again.':'Push service did not accept the test. Try again later.',code:result==='expired'?'subscription_expired':'push_failed'},result==='expired'?409:502);
  }
  return json({error:'Unknown action.'},400);
 }catch(error){return json({error:error instanceof SyntaxError?'Invalid request.':error.message||'Notification request failed.'},400)}})}
 alarm(){return this.run(async()=>{
  const now=Date.now();if(!Object.keys(this.devices).length){await this.persist();return}let failed=false;const tested=new Set();for(const [id,device] of Object.entries(this.devices))if(device.testAt&&device.testAt<=now){delete device.testAt;device.pending.push({id:crypto.randomUUID(),chat:'test',name:'GroupMe delayed test',body:'Your closed-tab test arrived.',at:now});device.pending=device.pending.slice(-30);device.needsPush=true;device.attempts=0;tested.add(id);const result=await this.push(device);if(result==='expired')delete this.devices[id];else if(result==='failed')failed=true}

  // Concurrent, bounded by the ten-chat limit. Each gateway call has a timeout.
  const results=await Promise.all(Object.entries(this.state.chats).map(async([key,chat])=>{try{return{key,chat,messages:await this.history(chat)}}catch{return{key,chat,error:true}}}));
  for(const result of results){
   if(result.error){failed=true;continue}const{key,chat,messages}=result;
   const seen=new Set(chat.seen),fresh=messages.filter(m=>!seen.has(String(m.id))&&Number(m.created_at)*1000>=chat.since-1000&&String(m.user_id||m.sender_id)!==this.state.accountId);
   chat.seen=[...new Set([...messages.map(m=>String(m.id)),...chat.seen])].slice(0,200);
   if(!fresh.length)continue;fresh.sort((a,b)=>a.created_at-b.created_at);const latest=fresh.at(-1);
   const event={id:crypto.randomUUID(),chat:key,name:chat.name,body:(latest.name?latest.name+': ':'')+(latest.text||'New attachment'),count:fresh.length,at:now};event.body=event.body.slice(0,180);
   for(const device of Object.values(this.devices)){if(Object.values(device.active||{}).some(value=>value.until>now&&value.chat===key))continue;device.pending=device.pending.filter(e=>e.at>now-86400000&&e.chat!==key);device.pending.push(event);device.pending=device.pending.slice(-30);device.needsPush=true;device.attempts=0}
  }
  for(const[id,device]of Object.entries(this.devices))if(device.needsPush&&!tested.has(id)){const result=await this.push(device);if(result==='expired')delete this.devices[id];else if(result==='failed')failed=true}
  this.state.failures=failed?(this.state.failures||0)+1:0;this.state.lastError=failed?'Some chat checks or push requests failed. They will retry automatically.':null;this.state.lastChecked=now;this.state.nextPoll=now+Math.min(300000,INTERVAL*2**Math.min(this.state.failures,4));await this.persist();
 })}
}
