import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
test('GroupMe account, group, history and send routes execute in Cloudflare runtime behind owner checks',async()=>{
 const bundle=await build({stdin:{contents:`import {createHandler} from './worker/index.js';const handler=createHandler();export default {fetch(request,env){return handler(request,env,{access:{getIdentity:async()=>({email:request.headers.get('X-Test-Owner')||'intruder@test'})}})}}`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
 let calls=0;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-11-16',script:bundle.outputFiles[0].text,bindings:{OWNER_EMAIL:'owner@test',GROUPME_ACCESS_TOKEN:'runtime-test-token'},outboundService:async request=>{
  calls++;const url=new URL(request.url);assert.equal(url.origin,'https://api.groupme.com');assert.equal(request.headers.get('X-Access-Token'),'runtime-test-token');
  if(url.pathname==='/v3/users/me')return Response.json({response:{id:'1',name:'Runtime User'}});
  if(url.pathname==='/v3/groups')return Response.json({response:[{id:'123',name:'Runtime Group'}]});
  if(request.method==='POST'){assert.deepEqual(await request.json(),{message:{source_guid:'runtime-guid',text:'Simulated message'}});return Response.json({response:{message:{id:'2'}}})}
  return Response.json({response:{messages:[{id:'1',name:'Member',text:'Test',created_at:1}]}});
 }}));
 try{
  const denied=await mf.dispatchFetch('https://dock.test/api/groupme/status');assert.equal(denied.status,403);assert.equal(calls,0);
  for(const action of ['status','groups','messages?group=123']){const r=await mf.dispatchFetch('https://dock.test/api/groupme/'+action,{headers:{'X-Test-Owner':'owner@test'}});assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).release,'groupme-rebuild-1')}
  const sent=await mf.dispatchFetch('https://dock.test/api/groupme/send',{method:'POST',headers:{'X-Test-Owner':'owner@test',Origin:'https://dock.test','Content-Type':'application/json'},body:JSON.stringify({group:'123',text:'Simulated message',source:'runtime-guid'})});assert.equal(sent.status,200,await sent.clone().text());assert.equal(calls,4);
 }finally{await mf.dispose()}
});
