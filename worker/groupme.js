// Only allowlisted categories leave the Worker, never raw exception messages.
function transportReason(error){const message=String(error?.message||'').toLowerCase();if(message.includes('redirect'))return 'REDIRECT_MODE';if(message.includes('dns')||message.includes('resolve'))return 'DNS';if(message.includes('tls')||message.includes('certificate')||message.includes('ssl'))return 'TLS';if(message.includes('header')||message.includes('bytestring'))return 'HEADER';if(message.includes('connection'))return 'CONNECTION';if(message.includes('context'))return 'RUNTIME_CONTEXT';return 'UNKNOWN'}
// Called only after Dock owner authentication and optional bot verification.
export async function groupme(request, env, networkFetch=fetch.bind(globalThis)) {
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 const url=new URL(request.url),action=url.pathname.slice('/api/groupme/'.length);
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed.'},405);
 if(action==='verify'&&request.method==='POST'){
  if(request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Invalid origin or content type.'},403);
  try{
   const raw=await request.text();if(raw.length>5000)return json({error:'Invalid token.'},400);
   const {token}=JSON.parse(raw);if(typeof token!=='string'||!token||token.length>4096||/[\r\n]/.test(token))return json({error:'Invalid token.'},400);
   const response=await networkFetch('https://api.groupme.com/v3/users/me',{headers:{'X-Access-Token':token},redirect:'manual',signal:AbortSignal.timeout(15000)});
   if(!response.ok)return json({error:'GroupMe could not verify this token. Start authorization again.'},502);
   const data=await response.json(),user=data.response;if(!user?.id||!user?.name)return json({error:'GroupMe returned no account profile.'},502);
   return json({name:user.name,id:String(user.id)});
  }catch{return json({error:'Account verification failed. Start authorization again.'},502)}
 }
 const accessToken=typeof env.GROUPME_ACCESS_TOKEN==='string'?env.GROUPME_ACCESS_TOKEN.trim():'';
 if(!accessToken)return json({error:'The running Worker has no GROUPME_ACCESS_TOKEN secret. Save and deploy that secret on chatgpt, then refresh. [GM_CONFIG_MISSING]'},503);
 if(/[^\x21-\x7e]/.test(accessToken))return json({error:'The GroupMe secret contains invalid whitespace or non-ASCII characters. Replace it with the copied access token only. [GM_CONFIG_FORMAT]'},503);
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
  const response=await networkFetch('https://api.groupme.com/v3'+path,{method:body?'POST':'GET',headers:{'X-Access-Token':accessToken,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'manual',signal:AbortSignal.timeout(15000)});
  if(response.status===304)return json({response:{messages:[]}});
  if(!response.ok)return json({error:response.status===401?'GroupMe rejected the access token. Copy Your Access Token from the application details, not the Client ID, and replace the Worker secret. [GM_TOKEN_REJECTED]':response.status===429?'GroupMe rate limit reached. Wait before refreshing. [GM_RATE_LIMIT]':`GroupMe returned HTTP ${response.status}. Refresh before retrying a send. [GM_UPSTREAM]`},response.status===429?429:502);
  let data;try{data=await response.json()}catch{return json({error:'GroupMe returned a non-JSON response. [GM_RESPONSE_FORMAT]'},502)}
 if(!data||!Object.hasOwn(data,'response'))return json({error:'GroupMe returned an unexpected response structure. [GM_RESPONSE_SHAPE]'},502);
 return json({response:data.response});
 }catch(error){const timeout=['TimeoutError','AbortError'].includes(error?.name);return json({error:timeout?'GroupMe did not respond within 15 seconds. [GM_TIMEOUT]':error?.message?.includes('Illegal invocation')?'The Worker could not invoke its network client. [GM_FETCH_BINDING]':`The Worker could not connect to GroupMe. [GM_TRANSPORT:${transportReason(error)}]`},502)}
}
