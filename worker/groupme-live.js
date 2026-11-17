// Owner authentication is enforced by the enclosing /api/groupme gateway.
// Bayeux documentation: https://dev.groupme.com/tutorials/push
export async function groupmeLive(request,token,networkFetch){
 const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}}),origin=new URL(request.url).origin;
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 if(request.headers.get('Origin')!==origin||!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Invalid request origin.'},403);
 let data;try{const raw=await request.text();if(raw.length>2000)throw Error();data=JSON.parse(raw)}catch{return json({error:'Invalid live request.'},400)}
 if(!['handshake','subscribe','connect','disconnect'].includes(data?.action)||!Number.isSafeInteger(data.sequence)||data.sequence<1||data.sequence>1000000000)return json({error:'Invalid live action.'},400);
 if(data.action!=='handshake'&&!/^[a-zA-Z0-9_-]{8,128}$/.test(data.clientId||''))return json({error:'Invalid live session.'},400);
 if(data.action==='subscribe'&&!/^\d{1,30}$/.test(data.group||''))return json({error:'Invalid conversation.'},400);
 const frame={channel:'/meta/'+data.action,id:String(data.sequence)};
 if(data.action==='handshake')Object.assign(frame,{version:'1.0',supportedConnectionTypes:['long-polling']});else frame.clientId=data.clientId;
 if(data.action==='subscribe')Object.assign(frame,{subscription:'/group/'+data.group,ext:{access_token:token,timestamp:Math.floor(Date.now()/1000)}});
 if(data.action==='connect')Object.assign(frame,{connectionType:'long-polling',advice:{timeout:20000}});
 try{
  const outgoing=[frame];
  if(data.action==='subscribe'){
   const profile=await networkFetch(new Request('https://api.groupme.com/v3/users/me',{headers:{'X-Access-Token':token,Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(10000)}));
   if(!profile.ok)throw Error();const owner=String((await profile.json()).response?.id||'');if(!/^\d{1,30}$/.test(owner))throw Error();
   outgoing.push({...frame,id:frame.id+':user',subscription:'/user/'+owner});
  }
  const response=await networkFetch(new Request('https://push.groupme.com/faye',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(outgoing),redirect:'manual',signal:AbortSignal.timeout(28000)}));
  if(!response.ok)return json({error:response.status===429?'Typing events are rate limited.':'Typing events are temporarily unavailable.'},response.status===429?429:502);
  const raw=await response.text();if(raw.length>200000)return json({error:'Typing response was too large.'},502);const frames=JSON.parse(raw);if(!Array.isArray(frames))throw Error();
  // Never forward ext, access tokens, signatures, raw upstream errors or message bodies.
  const events=[];for(const item of frames.slice(0,100)){
   if(typeof item?.channel!=='string')continue;
   if(item.channel.startsWith('/meta/')){const clean={channel:item.channel,successful:item.successful===true};if(/^\/(group|user)\/\d{1,30}$/.test(item.subscription||''))clean.subscription=item.subscription;if(/^[a-zA-Z0-9_-]{8,128}$/.test(item.clientId||''))clean.clientId=item.clientId;if(['retry','handshake','none'].includes(item.advice?.reconnect))clean.reconnect=item.advice.reconnect;const interval=Number(item.advice?.interval);if(Number.isFinite(interval))clean.interval=Math.min(60000,Math.max(500,interval));events.push(clean)}
   else if(/^\/(group|user)\/\d{1,30}$/.test(item.channel)){
    const value=item.data;if(!value||typeof value!=='object'||(value.type||item.type)!=='typing')continue;
    let subject=value.subject;if(typeof subject==='string'&&subject.length<8000){try{subject=JSON.parse(subject)}catch{subject=null}}
    const id=String(value.user_id||subject?.user_id||'');if(!/^\d{1,30}$/.test(id))continue;
    const group=item.channel.startsWith('/group/')?item.channel.slice(7):String(value.group_id||subject?.group_id||'');if(!/^\d{1,30}$/.test(group))continue;
    const name=String(value.name||subject?.name||'').slice(0,80);events.push({channel:'/group/'+group,type:'typing',userId:id,name});
   }
  }
  return json(JSON.parse(JSON.stringify({events}).split(token).join('[redacted]')));
 }catch{return json({error:'Typing events could not connect. Message refresh still works.'},502)}
}
