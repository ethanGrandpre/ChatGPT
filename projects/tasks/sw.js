self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// No fetch handler or offline cache: never cache/bypass the hub's private login.
// Pushes intentionally have no payload, so no task titles leave the device.
self.addEventListener('push',event=>event.waitUntil(self.registration.showNotification('Tasks reminder',{
 body:'One or more task reminders are due. Open Tasks to review them.',
 tag:'dock-tasks-reminder',renotify:true,icon:'icon-192.png',badge:'icon-192.png',
 data:{url:new URL('run.html?from=notification',self.registration.scope).href}
})));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const target=new URL('run.html?from=notification',self.registration.scope).href;const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows)if(client.url.startsWith(self.registration.scope)){await client.navigate(target);return client.focus()}return self.clients.openWindow(target)})())});
