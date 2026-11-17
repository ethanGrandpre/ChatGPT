/* Available in both the page and classic service worker. No network access. */
(()=>{
 let connection;
 function open(){if(!connection)connection=new Promise((resolve,reject)=>{const request=indexedDB.open('dock-task-reminders',1);request.onupgradeneeded=()=>request.result.createObjectStore('reminders',{keyPath:'id'});request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();connection=null};resolve(db)};request.onerror=()=>{connection=null;reject(request.error)}});return connection}
 async function transaction(mode,run){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('reminders',mode),store=tx.objectStore('reminders');let result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Reminder storage was interrupted.'));run(store,value=>{result=value})})}
 function replace(reminders){return transaction('readwrite',store=>{const request=store.getAll();request.onsuccess=()=>{const previous=new Map(request.result.map(r=>[r.id,r]));store.clear();for(const r of reminders){const old=previous.get(r.id);store.put({id:r.id,at:r.at,title:String(r.title||'Task reminder').slice(0,200),due:typeof r.due==='string'?r.due:'',shown:old?.at===r.at?old.shown:null})}}})}
 function due(now=Date.now()){return transaction('readonly',(store,done)=>{const request=store.getAll();request.onsuccess=()=>done(request.result.filter(r=>r.at<=now&&r.shown!==r.at).sort((a,b)=>a.at-b.at))})}
 function markShown(reminders){return transaction('readwrite',store=>{for(const r of reminders){const request=store.get(r.id);request.onsuccess=()=>{const current=request.result;if(current&&current.at===r.at)store.put({...current,shown:r.at})}}})}
 function clear(){return transaction('readwrite',store=>store.clear())}
 globalThis.DockTaskReminders={replace,due,markShown,clear};
})();
