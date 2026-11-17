import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../projects/groupme/callback.js',import.meta.url),'utf8');
async function callback(state,pending={state:'expected',created:Date.now()}){
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,{hidden:true,disabled:true,textContent:''});return elements.get(id)};let run,calls=0,scrubbed=false,copied=false;
 vm.runInNewContext(code,{URLSearchParams,Date,Number,AbortSignal,location:{search:'?access_token=test-token'+(state?'&state='+state:''),hash:'',pathname:'/callback.html'},history:{replaceState(){scrubbed=true}},sessionStorage:{getItem:()=>JSON.stringify(pending),removeItem(){}},document:{getElementById:get,addEventListener:(event,fn)=>run=fn},window:{addEventListener(){}},navigator:{clipboard:{writeText:async()=>copied=true}},fetch:async()=>{calls++;assert.equal(scrubbed,true);return Response.json({name:'Test user',id:'123'})}});
 await run();return{get,calls,scrubbed,copied:()=>copied};
}
test('missing OAuth state requires fresh session, verified profile and explicit confirmation',async()=>{const x=await callback(null);assert.equal(x.calls,1);assert.equal(x.get('result').hidden,true);assert.equal(x.get('verify').hidden,false);x.get('confirm').onclick();assert.equal(x.get('result').hidden,false);assert.equal(x.copied(),false)});
test('mismatched state and absent session fail before profile or token export',async()=>{for(const x of [await callback('wrong'),await callback(null,null)]){assert.equal(x.calls,0);assert.equal(x.scrubbed,true);assert.equal(x.get('result').hidden,true)}});
