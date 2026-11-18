const DEVICE='dock-tasks-device-v1';
let getTasks,registration,subscription,deviceId,syncTimer,syncing=false,dirty=false,forceSync=false,ready=false,busy=false,generation=0,detailsSaved=true,detailsSignature='',detailsJob=Promise.resolve(),scheduleSignature='',scheduleAt=0,scheduleCount=0;
const $=s=>document.querySelector(s),setStatus=t=>$('#notification-status').textContent=t;
async function api(data){
 const response=await fetch('/api/tasks-push?deviceId='+encodeURIComponent(deviceId||''),data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,deviceId})}:{cache:'no-store'});
 let result;try{result=await response.json()}catch{throw Error('Sign in to the hub again, then retry. The notification server did not return a valid response.')}
 if(!response.ok){const error=Error(result.error||'Notifications could not be configured.');error.status=response.status;error.code=result.code;throw error}return result;
}
function keyBytes(key){const raw=atob(key.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
function sameKey(sub,key){const existing=sub?.options?.applicationServerKey;if(!existing)return true;const a=new Uint8Array(existing),b=keyBytes(key);return a.length===b.length&&a.every((v,i)=>v===b[i])}
function buttons(){const on=!!subscription&&ready;$('#enable-notifications').hidden=on;$('#enable-notifications').disabled=busy;$('#disable-notifications').hidden=!on;$('#disable-notifications').disabled=busy;$('#test-delayed-notification').disabled=busy;$('#test-notification').disabled=busy}
function reminders(){const now=Date.now();return getTasks().filter(t=>t.status!=='done'&&Number.isFinite(t.remindAt)&&(t.remindAt>now-86400000||t.repeat&&t.repeat!=='none')&&t.remindAt>=0&&t.remindAt<=now+366*86400000).map(t=>({id:t.id,at:t.remindAt,title:t.title,due:t.due||'',...(t.repeat&&t.repeat!=='none'?{repeat:t.repeat,timeZone:t.timeZone}:{})}))}
async function recover(error){if(error.status===409){ready=false;if(error.code==='subscription_expired'){try{await subscription?.unsubscribe()}catch{}subscription=null}buttons()}}
async function saveDetails(items=reminders()){
 const signature=JSON.stringify(items);if(detailsSaved&&signature===detailsSignature)return;
 const job=detailsJob.then(async()=>{if(detailsSaved&&signature===detailsSignature)return;try{await DockTaskReminders.replace(items);detailsSignature=signature;detailsSaved=true}catch{detailsSaved=false;detailsSignature=''}});
 detailsJob=job.catch(()=>{});await job;
}
async function sync(force=false){
 if(!ready||!subscription)return;if(syncing){dirty=true;forceSync=forceSync||force;return}syncing=true;setStatus('Syncing reminders…');
 try{const items=reminders();await saveDetails(items);const scheduled=items.map(({id,at,repeat,timeZone})=>({id,at,...(repeat?{repeat,timeZone}:{})})),signature=JSON.stringify(scheduled);let count=scheduleCount;if(force||signature!==scheduleSignature||Date.now()-scheduleAt>=30000){const result=await api({action:'schedule',reminders:scheduled});scheduleSignature=signature;scheduleAt=Date.now();scheduleCount=result.scheduled;count=result.scheduled}if(ready)setStatus(`${count} reminder${count===1?'':'s'} scheduled on this device. ${detailsSaved?'Notifications include task names and due dates.':'Task details could not be saved; notifications will use a generic message.'} Delivery may be delayed by the OS.`)}
 catch(e){await recover(e);setStatus('Reminders not synced: '+e.message)}
 finally{syncing=false;if(dirty){const forceNext=forceSync;dirty=false;forceSync=false;sync(forceNext)}}
}
export function notificationsEnabled(){return ready&&!!subscription}
export function tasksChanged(){if(ready)saveDetails();clearTimeout(syncTimer);syncTimer=setTimeout(sync,500)}
async function action(fn){if(busy)return;generation++;busy=true;buttons();try{await fn()}catch(e){await recover(e);setStatus(e.message||'Could not configure notifications.')}finally{busy=false;buttons()}}
function activated(){let timer;return Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Notification setup timed out. Reload Tasks, sign in if asked, and try Enable notifications again.')),15000)})]).finally(()=>clearTimeout(timer))}
export async function initNotifications(readTasks){
 getTasks=readTasks;
 const supported='serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window&&window.isSecureContext;
 if(!supported){setStatus('Web Push is unavailable here. Open this page in Android Chrome (not an in-app browser). On iPhone/iPad, add Tasks to the Home Screen first.');$('#enable-notifications').disabled=true;$('#test-notification').disabled=true;$('#test-delayed-notification').disabled=true;return}
 try{deviceId=localStorage.getItem(DEVICE);if(!deviceId){deviceId=crypto.randomUUID();localStorage.setItem(DEVICE,deviceId)}}catch{setStatus('Browser storage is unavailable; device notifications cannot be configured.');$('#enable-notifications').disabled=true;$('#test-notification').disabled=true;$('#test-delayed-notification').disabled=true;return}
 async function enable(){
  // Run directly from the click, before any network await, for mobile permission rules.
  const permission=await Notification.requestPermission();if(permission!=='granted')throw Error(permission==='denied'?'Permission blocked. Allow notifications for this site in browser settings and allow Chrome notifications in Android Settings.':'Permission was not granted. Tap Enable notifications to try again.');
  setStatus('Connecting this device…');registration=await navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'});await activated();const config=await api();
  subscription=await registration.pushManager.getSubscription();
  if(subscription&&!sameKey(subscription,config.publicKey)){await subscription.unsubscribe();subscription=null}
  if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(config.publicKey)});
  await api({action:'subscribe',subscription:subscription.toJSON()});ready=true;scheduleSignature='';detailsSignature='';detailsSaved=true;await sync();
 }
 $('#enable-notifications').onclick=()=>action(enable);
 $('#disable-notifications').onclick=()=>action(async()=>{
  await api({action:'disable'});ready=false;scheduleSignature='';detailsSignature='';detailsSaved=true;await DockTaskReminders.clear().catch(()=>{});clearTimeout(syncTimer);if(subscription)await subscription.unsubscribe();subscription=null;setStatus('Device reminders disabled. Notification permission can also be changed in your browser settings.');
 });
 $('#test-notification').onclick=()=>action(async()=>{
  if(!ready||!subscription)await enable();
  if(!ready)throw Error('Connect notifications on this device before sending a test.');
  setStatus('Sending test notification…');const result=await api({action:'test'});setStatus(result.message+' Check your phone’s notification tray.');
 });
 $('#test-delayed-notification').onclick=()=>action(async()=>{if(!ready||!subscription)await enable();if(!ready)throw Error('Enable notifications first.');await api({action:'test-delayed'});setStatus('Scheduled on Cloudflare for 10 seconds from now. You can close this tab. Browser delivery may take longer.');});
 window.addEventListener('online',()=>{if(!busy)sync(true)});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&ready&&!busy)sync(true)});
 const start=generation;
 try{
  let reg=await navigator.serviceWorker.getRegistration(new URL('./',location.href).href);if(reg){try{reg=await navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'})}catch{}}const sub=await reg?.pushManager.getSubscription();
  if(start!==generation)return;
  if(sub&&Notification.permission==='granted'){
   const config=await api();if(start!==generation)return;registration=reg;subscription=sub;
   ready=config.subscribed&&sameKey(sub,config.publicKey);buttons();
   if(ready){await sync(true);return}
   setStatus('This device needs to reconnect. Tap Enable notifications, then Test notification.');return;
  }
  setStatus(Notification.permission==='denied'?'Notifications are blocked. Allow this site in browser settings and allow the browser’s notifications in Android Settings.':'Tap Test notification to send a real push to this device. First use asks for notification permission.');
 }catch(e){if(start===generation)setStatus('Notifications unavailable: '+e.message)}finally{buttons()}
}
