import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
test('GroupMe account, group, history and send routes execute in Cloudflare runtime behind owner checks',async()=>{
 const bundle=await build({stdin:{contents:`import {createHandler} from './worker/index.js';const handler=createHandler();export default {fetch(request,env){return handler(request,env,{access:{getIdentity:async()=>({email:request.headers.get('X-Test-Owner')||'intruder@test'})}})}}`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
 let calls=0,heart=false;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-11-16',script:bundle.outputFiles[0].text,bindings:{OWNER_EMAIL:'owner@test',GROUPME_ACCESS_TOKEN:'runtime-test-token'},outboundService:async request=>{
  calls++;const url=new URL(request.url);assert.equal(url.origin,'https://api.groupme.com');assert.equal(request.headers.get('X-Access-Token'),'runtime-test-token');
  if(url.pathname==='/v3/users/me')return Response.json({response:{id:'1',name:'Runtime User'}});
  if(url.pathname==='/v3/groups')return Response.json({response:[{id:'123',name:'Runtime Group'}]});
  if(url.pathname==='/v3/messages/123/1/like'){heart=true;return new Response(null,{status:202})}
  if(url.pathname==='/v3/conversations/123/messages/1'){assert.equal(request.method,'DELETE');return new Response(null,{status:204})}
  if(url.pathname==='/v3/chats')return Response.json({response:[{other_user:{id:'456',name:'DM Friend'}}]});
  if(url.pathname==='/v3/direct_messages'){if(request.method==='POST'){assert.deepEqual(await request.json(),{direct_message:{source_guid:'direct-runtime',recipient_id:'456',text:'Simulated direct message'}});return Response.json({response:{direct_message:{id:'3'}}})}return Response.json({response:{direct_messages:[{id:'1',text:'DM test',created_at:1}]}})}
  if(request.method==='POST'){assert.deepEqual(await request.json(),{message:{source_guid:'runtime-guid',text:'Simulated message'}});return Response.json({response:{message:{id:'2'}}})}
  return Response.json({response:{messages:[{id:'1',user_id:'1',name:'Member',text:'Test',created_at:1,favorited_by:heart?['1']:[]}]}});
 }}));
 try{
  const denied=await mf.dispatchFetch('https://dock.test/api/groupme/status');assert.equal(denied.status,403);assert.equal(calls,0);
  for(const action of ['status','groups','messages?group=123','chats','direct-messages?user=456']){const r=await mf.dispatchFetch('https://dock.test/api/groupme/'+action,{headers:{'X-Test-Owner':'owner@test'}});assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).release,'groupme-dms-readonly-1')}
  const sent=await mf.dispatchFetch('https://dock.test/api/groupme/send',{method:'POST',headers:{'X-Test-Owner':'owner@test',Origin:'https://dock.test','Content-Type':'application/json'},body:JSON.stringify({group:'123',text:'Simulated message',source:'runtime-guid'})});assert.equal(sent.status,200,await sent.clone().text());const direct=await mf.dispatchFetch('https://dock.test/api/groupme/send-direct',{method:'POST',headers:{'X-Test-Owner':'owner@test',Origin:'https://dock.test','Content-Type':'application/json'},body:JSON.stringify({user:'456',text:'Simulated direct message',source:'direct-runtime'})});assert.equal(direct.status,405);assert.equal((await direct.json()).code,'DM_READ_ONLY');for(const [action,body] of [['react',{group:'123',message:'1',liked:true}],['delete',{group:'123',message:'1'}]]){const r=await mf.dispatchFetch('https://dock.test/api/groupme/'+action,{method:'POST',headers:{'X-Test-Owner':'owner@test',Origin:'https://dock.test','Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200,await r.clone().text())}assert.equal(calls,12);
 }finally{await mf.dispose()}
});
