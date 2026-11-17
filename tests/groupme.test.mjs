import test from 'node:test';import assert from 'node:assert/strict';import {groupme} from '../worker/groupme.js';
const env={GROUPME_ACCESS_TOKEN:'private-token'};
test('GroupMe keeps token on fixed upstream and rejects cross-origin sends',async()=>{
 let calls=0;const network=async(url,options)=>{calls++;assert.equal(url,'https://api.groupme.com/v3/groups?per_page=100&page=1');assert.equal(options.headers['X-Access-Token'],'private-token');return Response.json({response:[{id:'1',name:'Test'}]})};
 const r=await groupme(new Request('https://dock.test/api/groupme/groups'),env,network);assert.equal(r.status,200);assert.equal((await r.text()).includes('private-token'),false);
 const denied=await groupme(new Request('https://dock.test/api/groupme/send',{method:'POST',headers:{Origin:'https://other.test','Content-Type':'application/json'},body:'{}'}),env,network);assert.equal(denied.status,403);assert.equal(calls,1);
});
test('GroupMe send validates body and preserves idempotency identifier',async()=>{
 const request=data=>new Request('https://dock.test/api/groupme/send',{method:'POST',headers:{Origin:'https://dock.test','Content-Type':'application/json'},body:JSON.stringify(data)});
 let calls=0;const network=async(url,opts)=>{calls++;assert.equal(url,'https://api.groupme.com/v3/groups/123/messages');assert.deepEqual(JSON.parse(opts.body),{message:{source_guid:'abcdefgh-123',text:'Hello'}});return Response.json({response:{message:{id:'1'}}})};
 assert.equal((await groupme(request({group:'../secrets',text:'x',source:'abcdefgh-123'}),env,network)).status,400);
 assert.equal((await groupme(request({group:'123',text:'Hello',source:'abcdefgh-123'}),env,network)).status,200);assert.equal(calls,1);
});
test('GroupMe reports missing configuration and sanitizes upstream errors',async()=>{assert.equal((await groupme(new Request('https://dock.test/api/groupme/groups'),{})).status,503);const r=await groupme(new Request('https://dock.test/api/groupme/groups'),env,async()=>new Response('private-token',{status:401}));assert.equal(r.status,502);assert.equal((await r.text()).includes('private-token'),false)});
test('default GroupMe fetch is bound to the runtime global',async()=>{const original=globalThis.fetch;try{globalThis.fetch=function(){assert.equal(this,globalThis);return Promise.resolve(Response.json({response:[]}))};const r=await groupme(new Request('https://dock.test/api/groupme/groups'),env);assert.equal(r.status,200)}finally{globalThis.fetch=original}});
test('GroupMe transport, timeout and response format errors stay distinct',async()=>{const request=()=>new Request('https://dock.test/api/groupme/groups');for(const [network,code]of [[async()=>{throw new TypeError('transport')},'GM_TRANSPORT'],[async()=>{throw new DOMException('timeout','TimeoutError')},'GM_TIMEOUT'],[async()=>new Response('<html>not json</html>'),'GM_RESPONSE_FORMAT']]){const r=await groupme(request(),env,network);assert.equal(r.status,502);assert.match(await r.text(),new RegExp(code))}});
