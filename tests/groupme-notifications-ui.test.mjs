import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';import{webcrypto}from'node:crypto';
const code=readFileSync(new URL('../projects/groupme-messages/notifications.js',import.meta.url),'utf8');
test('chat toggle enables device with permission, registers subscription, then watches exact conversation',async()=>{
 const elements=new Map(),calls=[];const get=id=>{if(!elements.has(id))elements.set(id,{hidden:false,disabled:false,textContent:'',setAttribute(){},showModal(){},close(){}});return elements.get(id)};
 const subscription={options:{},toJSON:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/example'}),unsubscribe:async()=>{}};
 const registration={active:true,pushManager:{getSubscription:async()=>null,subscribe:async()=>subscription}};
 const Notification={permission:'default',requestPermission:async()=>{calls.push('permission');Notification.permission='granted';return'granted'}};
 const serviceWorker={getRegistration:async()=>null,register:async()=>{calls.push('register');return registration}};
 const context={setInterval:()=>1,document:{getElementById:get,addEventListener(){}},window:{addEventListener(){},isSecureContext:true,PushManager:{},Notification,DockGroupMeChat:{getCurrent:()=>({kind:'groups',id:'123',name:'Group'})}},navigator:{serviceWorker},Notification,location:{href:'https://dock.test/projects/groupme-messages/run.html'},crypto:webcrypto,URL,Set,Uint8Array,AbortSignal,atob,encodeURIComponent,localStorage:{getItem:()=>null,setItem(){}},fetch:async(url,options)=>{if(!options.body)return Response.json({publicKey:'AQ',chats:[],subscribed:false});const body=JSON.parse(options.body);calls.push(body.action);if(body.action==='watch'){assert.equal(body.chat.id,'123');assert.equal(body.enabled,true);return Response.json({chats:['groups:123']})}return Response.json({subscribed:true})}};
 vm.runInNewContext(code,context);await new Promise(resolve=>setImmediate(resolve));await get('chat-notify').onclick();assert.deepEqual(calls,['permission','register','subscribe','presence','watch']);assert.equal(get('chat-notify').textContent,'Notify on');
});
