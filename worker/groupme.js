// Called only after Dock owner authentication and optional bot verification.
export async function groupme(request, env, networkFetch=fetch) {
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 const url=new URL(request.url),action=url.pathname.slice('/api/groupme/'.length);
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed.'},405);
 if(!env.GROUPME_ACCESS_TOKEN)return json({error:'Connect your account: add GROUPME_ACCESS_TOKEN as a Cloudflare Worker secret. See the GroupMe project setup.'},503);
 let path,body;
 const id=url.searchParams.get('group');
 if(request.method==='GET'&&action==='groups')path='/groups?per_page=100&page='+Math.min(100,Math.max(1,Number(url.searchParams.get('page'))||1));
 else if(request.method==='GET'&&action==='messages'&&/^\d{1,30}$/.test(id||'')){
  path='/groups/'+id+'/messages?limit=40';const before=url.searchParams.get('before');if(before){if(!/^\d{1,40}$/.test(before))return json({error:'Invalid message cursor.'},400);path+='&before_id='+before;}
 }else if(request.method==='POST'&&action==='send'){
  if(request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Invalid origin or content type.'},403);
  if(Number(request.headers.get('Content-Length'))>16000)return json({error:'Message too large.'},413);
  let data;try{const raw=await request.text();if(raw.length>16000)return json({error:'Message too large.'},413);data=JSON.parse(raw)}catch{return json({error:'Invalid message.'},400)}
  if(!/^\d{1,30}$/.test(data.group||'')||typeof data.text!=='string'||!data.text.trim()||data.text.length>1000||! /^[\w-]{8,80}$/.test(data.source||''))return json({error:'Choose a group and enter up to 1,000 characters.'},400);
  path='/groups/'+data.group+'/messages';body={message:{source_guid:data.source,text:data.text.trim()}};
 }else return json({error:'Unknown GroupMe action.'},400);
 try{
  const response=await networkFetch('https://api.groupme.com/v3'+path,{method:body?'POST':'GET',headers:{'X-Access-Token':env.GROUPME_ACCESS_TOKEN,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});
  if(response.status===304)return json({response:{messages:[]}});
  if(!response.ok)return json({error:response.status===401?'GroupMe rejected your token. Replace the Worker secret.':response.status===429?'GroupMe rate limit reached. Wait before refreshing.':'GroupMe request failed. Try refreshing before sending again.'},response.status===401?502:response.status===429?429:502);
  const data=await response.json();return json({response:data.response});
 }catch{return json({error:'Could not reach GroupMe. Refresh the conversation before retrying a send.'},502)}
}
