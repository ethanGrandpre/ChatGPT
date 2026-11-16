import {SignJWT} from 'jose';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
export function pushEndpoint(value){const u=new URL(value);const h=u.hostname;const allowed=h==='fcm.googleapis.com'||h==='updates.push.services.mozilla.com'||h==='push.services.mozilla.com'||h==='web.push.apple.com'||h.endsWith('.notify.windows.com');if(u.protocol!=='https:'||u.username||u.password||u.port||!allowed||value.length>4096)throw Error('Unsupported push-service endpoint.');return u.href}
export function validateReminders(value,now=Date.now()){if(!Array.isArray(value)||value.length>500)throw Error('Too many reminders.');const ids=new Set();return value.map(r=>{if(!r||typeof r.id!=='string'||r.id.length>100||ids.has(r.id)||!Number.isFinite(r.at)||r.at<now-86400000||r.at>now+366*86400000)throw Error('Invalid reminder time. Choose a time within the next year.');ids.add(r.id);return{id:r.id,at:Math.round(r.at)}})}
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function body(request){let length=0,text='';for await(const chunk of request.body||[]){length+=chunk.length;if(length>75000)throw Error('Request too large.');text+=new TextDecoder().decode(chunk)}return JSON.parse(text)}
export class TaskPush {
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.queue=Promise.resolve();this.ready=this.init();this.networkFetch=fetch;}
 async init(){this.devices={};this.deviceIds=await this.ctx.storage.get('deviceIds')||[];for(const id of this.deviceIds){const device=await this.ctx.storage.get('device:'+id);if(device)this.devices[id]=device}this.keys=await this.ctx.storage.get('keys')||null;this.tokens=await this.ctx.storage.get('tokens')||{};}
 run(fn){const result=this.queue.then(async()=>{await this.ready;return fn()});this.queue=result.catch(()=>{});return result;}
 async ensureKeys(){if(!this.keys){const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);this.keys={privateJwk:await crypto.subtle.exportKey('jwk',pair.privateKey),publicKey:b64(new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey)))};await this.ctx.storage.put('keys',this.keys)}return this.keys;}
 async persist(){const ids=Object.keys(this.devices);for(const id of ids)await this.ctx.storage.put('device:'+id,this.devices[id]);for(const id of this.deviceIds)if(!this.devices[id])await this.ctx.storage.delete('device:'+id);await this.ctx.storage.put('deviceIds',ids);this.deviceIds=ids;let next=Infinity;for(const d of Object.values(this.devices)){if(d.reminders.length){const due=Math.min(...d.reminders.map(r=>r.at));next=Math.min(next,Math.max(due,d.retryAt||0))}}if(Number.isFinite(next))await this.ctx.storage.setAlarm(Math.max(Date.now()+1000,next));else await this.ctx.storage.deleteAlarm();}
 async authorization(endpoint){const keys=await this.ensureKeys(),aud=new URL(endpoint).origin,now=Math.floor(Date.now()/1000);let cached=this.tokens[aud];if(!cached||cached.refresh<now){const key=await crypto.subtle.importKey('jwk',keys.privateJwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);const jwt=await new SignJWT({aud,sub:'mailto:'+this.env.OWNER_EMAIL}).setProtectedHeader({alg:'ES256',typ:'JWT'}).setExpirationTime(now+12*3600).sign(key);cached={jwt,refresh:now+6*3600};this.tokens[aud]=cached;await this.ctx.storage.put('tokens',this.tokens)}return`vapid t=${cached.jwt}, k=${keys.publicKey}`;}
 async deliver(device){const response=await this.networkFetch(device.endpoint,{method:'POST',headers:{Authorization:await this.authorization(device.endpoint),TTL:'3600',Urgency:'normal',Topic:'dock-tasks'},body:null,redirect:'error',signal:AbortSignal.timeout(10000)});return response.status;}
 fetch(request){return this.run(async()=>{try{
  const url=new URL(request.url),id=url.searchParams.get('deviceId');
  if(request.method==='GET'){const keys=await this.ensureKeys(),device=this.devices[id];return json({configured:true,publicKey:keys.publicKey,subscribed:!!device,scheduled:device?.reminders.length||0,lastAccepted:device?.lastAccepted||null,lastError:device?.lastError||null});}
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  const data=await body(request);if(!data||typeof data.deviceId!=='string'||! /^[a-f0-9-]{36}$/i.test(data.deviceId))throw Error('Invalid device identifier.');
  const deviceId=data.deviceId;let device=this.devices[deviceId];
  if(data.action==='subscribe'){
   const endpoint=pushEndpoint(data.subscription?.endpoint||'');
   if(!device&&Object.keys(this.devices).length>=12)throw Error('Device limit reached. Disable notifications on an unused device first.');
   device={endpoint,reminders:device?.reminders||[],sent:device?.sent||{},lastTest:device?.lastTest||0,lastError:null};this.devices[deviceId]=device;await this.ensureKeys();await this.persist();return json({subscribed:true});
  }
  if(data.action==='disable'){delete this.devices[deviceId];await this.persist();return json({subscribed:false})}
  if(!device)return json({error:'Device subscription is missing. Enable notifications again.'},409);
  if(data.action==='schedule'){
   const reminders=validateReminders(data.reminders);device.reminders=reminders.filter(r=>device.sent[r.id]!==r.at);const retain=new Set(reminders.map(r=>r.id));device.sent=Object.fromEntries(Object.entries(device.sent).filter(([id])=>retain.has(id)));device.retryAt=0;device.attempts=0;await this.persist();return json({scheduled:device.reminders.length});
  }
  if(data.action==='test'){
   if(Date.now()-(device.lastTest||0)<30000)return json({error:'Wait 30 seconds between test notifications.'},429);
   device.lastTest=Date.now();await this.persist();let code;try{code=await this.deliver(device)}catch{code=503}
   if(code===404||code===410){delete this.devices[deviceId];await this.persist();return json({error:'This device subscription expired. Enable notifications again.'},409)}
   if(code<200||code>=300){device.lastError='Push service rejected the test ('+code+').';await this.persist();return json({error:device.lastError},502)}
   device.lastAccepted=Date.now();device.lastError=null;await this.persist();return json({accepted:true,message:'Sent to your push service. Device delivery depends on browser and OS settings.'});
  }
  throw Error('Unknown action.');
 }catch(e){return json({error:e.message||'Invalid request.'},400)}});}
 alarm(){return this.run(async()=>{const now=Date.now();for(const[id,device]of Object.entries(this.devices)){const due=device.reminders.filter(r=>r.at<=now);if(!due.length||(device.retryAt||0)>now)continue;let code;try{code=await this.deliver(device)}catch{code=503}if(code===404||code===410){delete this.devices[id];continue}if(code>=200&&code<300){for(const r of due)device.sent[r.id]=r.at;device.reminders=device.reminders.filter(r=>r.at>now);device.lastAccepted=now;device.lastError=null;device.attempts=0;device.retryAt=0}else{device.attempts=(device.attempts||0)+1;device.lastError='Delivery was not accepted by the push service ('+code+').';if(device.attempts>=3){for(const r of due)device.sent[r.id]=r.at;device.reminders=device.reminders.filter(r=>r.at>now);device.retryAt=0;device.attempts=0}else device.retryAt=now+60000*device.attempts}}await this.persist()});}
}
