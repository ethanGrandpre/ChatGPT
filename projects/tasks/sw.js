importScripts('recurrence.js','reminder-store.js');
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// No fetch handler or asset cache: never cache/bypass the hub's private login.
// Task content stays in this device's IndexedDB, not in the server push.
function dueLabel(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return'';const [y,m,d]=value.split('-').map(Number),date=new Date(y,m-1,d,12);if(date.getFullYear()!==y||date.getMonth()!==m-1||date.getDate()!==d)return'';return 'Due '+date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}
self.addEventListener('push',event=>event.waitUntil((async()=>{
 let reminders=[];try{reminders=await DockTaskReminders.due()}catch{}
 let title='Tasks reminder',body='One or more task reminders are due. Open Tasks to review them.';
 if(reminders.length===1){title=reminders[0].title||'Task reminder';body=dueLabel(reminders[0].due)||'Your task reminder is due.'}
 else if(reminders.length>1){title=`${reminders.length} task reminders`;body=reminders.slice(0,3).map(r=>r.title+(dueLabel(r.due)?' — '+dueLabel(r.due):'')).join('\n');if(reminders.length>3)body+=`\n+${reminders.length-3} more. Open Tasks to review.`}
 await self.registration.showNotification(title,{body,tag:'dock-tasks-reminder',renotify:true,icon:'icon-192.png',badge:'icon-192.png',data:{url:new URL('run.html?from=notification',self.registration.scope).href}});
 try{await DockTaskReminders.markShown(reminders)}catch{}
 try{const deviceId=new URL(self.location.href).searchParams.get('device');if(deviceId)await fetch('/api/tasks-push',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'received',deviceId})})}catch{}
})()));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const target=new URL('run.html?from=notification',self.registration.scope).href;const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows)if(client.url.startsWith(self.registration.scope)){await client.navigate(target);return client.focus()}return self.clients.openWindow(target)})())});
