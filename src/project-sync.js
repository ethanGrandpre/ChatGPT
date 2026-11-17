/* Private, owner-only synchronization for Dock project localStorage records. */
(()=>{
 const PREFIX='dock-',META='__dock_project_sync_meta_v1',CLIENT='__dock_project_sync_client_v1',DEVICE_KEY='dock-tasks-device-v1',MAX_VALUE=300000;
 let storage;try{storage=window.localStorage}catch{window.DockProjectSync={ready:Promise.resolve(),getStatus:()=> 'Browser storage is unavailable'};return}
 const rawSet=Storage.prototype.setItem,rawRemove=Storage.prototype.removeItem,rawClear=Storage.prototype.clear;
 let meta={},pending={},timer,requesting=false,again=false,clientId,updateAvailable=false,serverRevision=null;
 const eligible=key=>typeof key==='string'&&key.startsWith(PREFIX)&&key!==DEVICE_KEY&&!key.startsWith('dock-sync-');
 const readJson=(key,fallback)=>{try{const value=JSON.parse(storage.getItem(key));return value&&typeof value==='object'&&!Array.isArray(value)?value:fallback}catch{return fallback}};
 function initMeta(){meta=readJson(META,{});try{clientId=storage.getItem(CLIENT);if(!clientId){clientId=crypto.randomUUID();rawSet.call(storage,CLIENT,clientId)}}catch{clientId='temporary-'+Math.random().toString(36).slice(2)}}
 function writeMeta(){try{const latest=readJson(META,{});for(const [key,entry]of Object.entries(latest))if(compare(entry,meta[key])>0)meta[key]=entry;rawSet.call(storage,META,JSON.stringify(meta))}catch{}}
 function timestamp(){const last=Math.max(0,...Object.values(meta).map(e=>Number(e?.modifiedAt)||0));return Math.max(Date.now(),last+1)}
 function localEntry(key,value){const entry={value,modifiedAt:timestamp(),clientId};meta[key]=entry;writeMeta();pending[key]=entry;schedule()}
 function status(message,kind='ok'){
  if(!document.body){document.addEventListener('DOMContentLoaded',()=>status(message,kind),{once:true});return}
  let badge=document.getElementById('dock-sync-status');if(!badge){badge=document.createElement('button');badge.type='button';badge.id='dock-sync-status';badge.setAttribute('aria-live','polite');badge.style.cssText='position:fixed;z-index:9999;right:12px;bottom:12px;max-width:calc(100vw - 24px);padding:6px 9px;border:1px solid var(--line,#ddd);border-radius:6px;background:var(--bg,#fff);color:var(--muted,#777);font:10px/1.4 system-ui,sans-serif;box-shadow:0 2px 12px #00000012;transition:opacity .2s';badge.onclick=()=>{if(badge.dataset.kind==='update')location.reload()};document.body.append(badge)}
  badge.textContent=message;badge.title=kind==='update'?'New project data arrived from another device. Tap to reload and view it.':'Project data syncs to private Cloudflare storage protected by your Dock sign-in. It is not end-to-end encrypted.';badge.dataset.kind=kind;badge.style.cursor=kind==='update'?'pointer':'default';badge.style.opacity='1';clearTimeout(badge.hideTimer);if(kind==='ok'&&message==='Synced across devices'&&!updateAvailable)badge.hideTimer=setTimeout(()=>{badge.style.opacity='0'},2600);
 }
 function readLocal(){const values={};for(let i=0;i<storage.length;i++){const key=storage.key(i);if(eligible(key))values[key]=storage.getItem(key)}return values}
 function compare(a,b){return(Number(a?.modifiedAt)||0)-(Number(b?.modifiedAt)||0)||String(a?.clientId||'').localeCompare(String(b?.clientId||''))}
 function mergeJson(localValue,remoteValue){
  try{
   const local=JSON.parse(localValue),remote=JSON.parse(remoteValue);
   const merge=(a,b)=>{
    if(Array.isArray(a)&&Array.isArray(b)){
     if([...a,...b].length>0&&[...a,...b].every(x=>x&&typeof x==='object'&&typeof x.id==='string')){const map=new Map(a.map(x=>[x.id,x]));for(const x of b)map.set(x.id,{...map.get(x.id),...x});return [...map.values()]}
     const seen=new Set(a.map(x=>JSON.stringify(x)));return [...a,...b.filter(x=>!seen.has(JSON.stringify(x)))]
    }
    if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){const out={...a};for(const [k,v]of Object.entries(b))out[k]=k in out?merge(out[k],v):v;return out}
    return b;
   };
   return JSON.stringify(merge(local,remote));
  }catch{return remoteValue}
 }
 function applyEntry(key,entry,{announce=false}={}){
  const before=storage.getItem(key);
  if(entry.value===null)rawRemove.call(storage,key);else rawSet.call(storage,key,entry.value);
  meta[key]=entry;delete pending[key];writeMeta();
  if(before!==entry.value){
   const event=new StorageEvent('storage',{key,oldValue:before,newValue:entry.value,storageArea:storage,url:location.href});window.dispatchEvent(event);
   window.dispatchEvent(new CustomEvent('dock-project-sync-change',{detail:{key}}));
   if(key==='dock-v1')window.DockAppearance?.apply();
   if(announce&&key!=='dock-v1'&&key!=='dock-tasks-v1'){updateAvailable=true;status('Updated from another device · tap to reload','update')}
  }
 }
 function schedule(delay=700){clearTimeout(timer);timer=setTimeout(()=>flush(),delay)}
 async function api(method='GET',entries){const url='/api/project-sync'+(method==='GET'&&serverRevision!==null?'?since='+encodeURIComponent(serverRevision):'');const response=await fetch(url,{method,cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(12000),...(method==='POST'?{headers:{'Content-Type':'application/json'},body:JSON.stringify({entries})}:{})});let data;try{data=await response.json()}catch{throw Error('Sign in to the private workspace, then reload to sync.')}if(!response.ok)throw Error(data.error||`Sync unavailable (${response.status}).`);return data}
 function accept(remote,{initial=false}={}){
  const local=readLocal(),keys=new Set([...Object.keys(remote),...Object.keys(local),...Object.keys(meta)]);
  for(const key of keys){if(!eligible(key))continue;const cloud=remote[key],value=Object.hasOwn(local,key)?local[key]:null,prior=meta[key];
   if(!cloud){if(value!==null){const entry=prior&&prior.value===value?prior:{value,modifiedAt:timestamp(),clientId};meta[key]=entry;pending[key]=entry}continue}
   let candidate=prior;
   if(value!==null&&(!candidate||candidate.value!==value)){
    let merged=value;
    if(initial&&!candidate&&cloud.value!==null)merged=mergeJson(value,cloud.value);
    candidate={value:merged,modifiedAt:timestamp(),clientId};
   }
   if(candidate&&candidate.value!==cloud.value&&compare(candidate,cloud)>0){
    if(candidate.value!==value){if(candidate.value===null)rawRemove.call(storage,key);else rawSet.call(storage,key,candidate.value)}
    meta[key]=candidate;pending[key]=candidate;
   }else applyEntry(key,cloud,{announce:!initial});
  }
  writeMeta();
 }
 async function flush(){
  if(requesting){again=true;return}const changes=pending;pending={};if(!Object.keys(changes).length)return;requesting=true;status('Syncing changes…','busy');
  try{const result=await api('POST',changes);serverRevision=result.revision??serverRevision;accept(result.entries||{});status(updateAvailable?'Updated from another device · tap to reload':'Synced across devices',updateAvailable?'update':'ok')}
  catch(error){pending={...changes,...pending};status(`Waiting to sync · ${error.message}`,'error')}
  finally{requesting=false;if(again||Object.keys(pending).length){again=false;schedule(1500)}}
 }
 const ready=(async()=>{initMeta();status('Connecting private sync…','busy');try{const result=await api();serverRevision=result.revision??null;accept(result.entries||{},{initial:true});if(Object.keys(pending).length)await flush();else status('Synced across devices')}catch(error){status(`Sync unavailable · ${error.message}`,'error')}})();
 Storage.prototype.setItem=function(key,value){rawSet.call(this,key,value);if(this===storage&&eligible(String(key))){const text=String(value);if(text.length<=MAX_VALUE)localEntry(String(key),text);else status('This item is too large to sync.','error')}};
 Storage.prototype.removeItem=function(key){const old=this.getItem(key);rawRemove.call(this,key);if(this===storage&&eligible(String(key))&&old!==null)localEntry(String(key),null)};
 Storage.prototype.clear=function(){if(this!==storage){rawClear.call(this);return}const previous=readLocal();rawClear.call(this);initMeta();for(const key of Object.keys(previous)){const entry={value:null,modifiedAt:timestamp(),clientId};meta[key]=entry;pending[key]=entry}writeMeta();if(Object.keys(pending).length)schedule()};
 window.DockProjectSync={ready,flush:()=>flush(),getStatus:()=>document.getElementById('dock-sync-status')?.textContent||'Syncing'};
 window.addEventListener('storage',event=>{if(event.isTrusted&&event.storageArea===storage&&eligible(event.key)){const entry=readJson(META,{})[event.key];if(entry){meta[event.key]=entry;pending[event.key]=entry;schedule(100)}}});
 window.addEventListener('online',()=>{api().then(result=>{if(result.unchanged)return;serverRevision=result.revision??serverRevision;accept(result.entries||{});flush()}).catch(error=>status(`Waiting to sync · ${error.message}`,'error'))});
 setInterval(()=>{if(document.visibilityState==='visible'&&!requesting)api().then(result=>{if(result.unchanged)return;serverRevision=result.revision??serverRevision;accept(result.entries||{});if(Object.keys(pending).length)flush()}).catch(()=>{})},15000);
})();
