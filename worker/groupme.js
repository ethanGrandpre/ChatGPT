// All calls reach this module only after Dock owner authentication.
export const GROUPME_RELEASE='groupme-rebuild-1';
const ORIGIN='https://api.groupme.com';
const reply=(data,status=200)=>Response.json({...data,release:GROUPME_RELEASE},{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Dock-GroupMe-Release':GROUPME_RELEASE}});
function failure(message,code,status=502){return reply({error:message,code},status)}
function reason(error){const m=String(error?.message||'').toLowerCase();if(['AbortError','TimeoutError'].includes(error?.name))return 'TIMEOUT';if(m.includes('dns')||m.includes('resolve'))return 'DNS';if(m.includes('tls')||m.includes('ssl')||m.includes('certificate'))return 'TLS';if(m.includes('header')||m.includes('bytestring'))return 'HEADER';if(m.includes('redirect'))return 'REDIRECT';if(m.includes('invocation')||m.includes('context'))return 'RUNTIME';return 'CONNECTION'}
export async function groupme(request,env,networkFetch=fetch.bind(globalThis)){
 const url=new URL(request.url),action=url.pathname.slice('/api/groupme/'.length);
 if(!['GET','POST'].includes(request.method))return failure('Method not allowed.','METHOD',405);
 const token=typeof env.GROUPME_ACCESS_TOKEN==='string'?env.GROUPME_ACCESS_TOKEN.trim():'';
 if(!token)return failure('Add GROUPME_ACCESS_TOKEN as a Secret on the chatgpt Worker, then save and deploy.','SETUP',503);
 if(/[^\x21-\x7e]/.test(token))return failure('The saved token contains invalid characters. Copy only Your Access Token from GroupMe’s application page.','TOKEN_FORMAT',503);
 let path,body;
 if(request.method==='GET'&&action==='status')path='/v3/users/me';
 else if(request.method==='GET'&&action==='groups'){
  const page=Number(url.searchParams.get('page')||1);if(!Number.isInteger(page)||page<1||page>100)return failure('Invalid page.','INPUT',400);
  path='/v3/groups?per_page=100&page='+page;
 }else if(request.method==='GET'&&action==='messages'){
  const id=url.searchParams.get('group'),before=url.searchParams.get('before');
  if(!/^\d{1,30}$/.test(id||'')||(before&&!/^\d{1,40}$/.test(before)))return failure('Invalid conversation.','INPUT',400);
  path='/v3/groups/'+id+'/messages?limit=40'+(before?'&before_id='+before:'');
 }else if(request.method==='POST'&&action==='send'){
  if(request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.startsWith('application/json'))return failure('Request origin was rejected.','ORIGIN',403);
  if(Number(request.headers.get('Content-Length'))>16000)return failure('Message is too large.','INPUT',413);
  try{const raw=await request.text();if(raw.length>16000)return failure('Message is too large.','INPUT',413);body=JSON.parse(raw)}catch{return failure('Invalid message.','INPUT',400)}
  if(!/^\d{1,30}$/.test(body?.group||'')||typeof body.text!=='string'||!body.text.trim()||body.text.length>1000||! /^[\w-]{8,80}$/.test(body.source||''))return failure('Choose a group and enter up to 1,000 characters.','INPUT',400);
  path='/v3/groups/'+body.group+'/messages';body={message:{source_guid:body.source,text:body.text.trim()}};
 }else return failure('Unknown GroupMe action.','ROUTE',404);
 try{
  const upstream=new Request(ORIGIN+path,{method:body?'POST':'GET',headers:{'X-Access-Token':token,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'manual',signal:AbortSignal.timeout(15000)});
  const response=await networkFetch(upstream);
  if(response.status===304&&action==='messages')return reply({response:{messages:[]}});
  if(!response.ok){
   if(response.status===401)return failure('GroupMe rejected the saved token. Copy Your Access Token (not Client ID), replace the Worker secret, and deploy.','TOKEN_REJECTED');
   if(response.status===429)return failure('GroupMe is limiting requests. Wait a minute before reconnecting.','RATE_LIMIT',429);
   return failure(`GroupMe returned HTTP ${response.status}.`,response.status>=300&&response.status<400?'REDIRECT':'UPSTREAM_HTTP');
  }
  let data;try{data=await response.json()}catch{return failure('GroupMe returned an unreadable response.','RESPONSE_FORMAT')}
  if(!data||!Object.hasOwn(data,'response'))return failure('GroupMe returned an unexpected response.','RESPONSE_SHAPE');
  if(action==='status'){
   if(!data.response?.id||typeof data.response?.name!=='string')return failure('GroupMe returned no account profile.','ACCOUNT');
   return reply({response:{name:data.response.name,id:String(data.response.id)}});
  }
  return reply({response:data.response});
 }catch(error){return failure('The Worker could not complete the GroupMe request. No token change is needed unless TOKEN_REJECTED appears.','TRANSPORT_'+reason(error))}
}
