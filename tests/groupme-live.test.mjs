import test from 'node:test';import assert from 'node:assert/strict';import {groupmeLive} from '../worker/groupme-live.js';
const token='private-test-token',clientId='session_123456',request=(data,origin='https://dock.test')=>new Request('https://dock.test/api/groupme/live',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({sequence:1,...data})});
test('typing proxy creates fixed-origin Bayeux frames and strips upstream secrets and message bodies',async()=>{
 for(const action of ['handshake','subscribe','connect','disconnect']){
  const result=await groupmeLive(request({action,clientId,group:'123'}),token,async req=>{assert.equal(req.url,'https://push.groupme.com/faye');assert.equal(req.redirect,'manual');const [frame]=await req.json();assert.equal(frame.channel,'/meta/'+action);if(action==='subscribe'){assert.equal(frame.ext.access_token,token);assert.equal(frame.subscription,'/group/123')}return Response.json([{channel:'/meta/'+action,successful:true,clientId,ext:{access_token:token}},{channel:'/group/123',data:{type:'typing',user_id:'2',name:'Friend'},ext:{access_token:token}},{channel:'/user/1',data:{type:'line.create',subject:{text:'private message'}}}])});
  assert.equal(result.status,200);const raw=await result.text();assert.equal(raw.includes(token),false);assert.equal(raw.includes('private message'),false);assert.equal(raw.includes('ext'),false);const {events}=JSON.parse(raw);assert.equal(events[0].clientId,clientId);assert.equal(events[1].type,'typing');assert.equal(events[1].userId,'2');
 }
});
test('typing requests reject bad origins, destinations, channels and payloads before network',async()=>{
 let calls=0;const net=async()=>{calls++;return Response.json([])};
 for(const data of [{action:'publish',clientId},{action:'subscribe',clientId,group:'../other'},{action:'connect',clientId:'https://evil.test'},{action:'handshake',sequence:-1}])assert.equal((await groupmeLive(request(data),token,net)).status,400);
 assert.equal((await groupmeLive(request({action:'handshake'},'https://other.test'),token,net)).status,403);assert.equal(calls,0);
});
test('typing errors never return raw provider response or exception secrets',async()=>{
 for(const net of [async()=>{throw Error(token)},async()=>new Response(token,{status:302}),async()=>new Response(token),async()=>new Response(token,{status:429})]){const result=await groupmeLive(request({action:'handshake'}),token,net);assert.ok([429,502].includes(result.status));assert.equal((await result.text()).includes(token),false)}
});
