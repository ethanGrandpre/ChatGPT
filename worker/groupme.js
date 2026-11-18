import {groupmeAudio,audioURL} from './groupme-audio.js';
import {groupmeLive} from './groupme-live.js';
// All calls reach this module only after Dock owner authentication.
export const GROUPME_RELEASE='groupme-notify-emoji-1';
export const GROUPME_EMOJI=['❤️','👍','🤣','🎉','🔥','😮','👀','😭','🥺','🙏','💀','🫶','🤬','💅','🫠'];
const ORIGIN='https://api.groupme.com';
const reply=(data,status=200)=>Response.json({...data,release:GROUPME_RELEASE},{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Dock-GroupMe-Release':GROUPME_RELEASE}});
function failure(message,code,status=502){return reply({error:message,code},status)}
function reason(error){const m=String(error?.message||'').toLowerCase();if(['AbortError','TimeoutError'].includes(error?.name))return 'TIMEOUT';if(m.includes('dns')||m.includes('resolve'))return 'DNS';if(m.includes('tls')||m.includes('ssl')||m.includes('certificate'))return 'TLS';if(m.includes('header')||m.includes('bytestring'))return 'HEADER';if(m.includes('redirect'))return 'REDIRECT';if(m.includes('invocation')||m.includes('context'))return 'RUNTIME';return 'CONNECTION'}
export async function groupme(request,env,networkFetch=fetch.bind(globalThis)){
 const url=new URL(request.url),action=url.pathname.slice('/api/groupme/'.length);
 if(action==='send-direct')return failure('GroupMe does not provide DM sending through its Developer API. DMs in Dock are read-only.','DM_READ_ONLY',405);
 if(!['GET','POST'].includes(request.method))return failure('Method not allowed.','METHOD',405);
 const token=typeof env.GROUPME_ACCESS_TOKEN==='string'?env.GROUPME_ACCESS_TOKEN.trim():'';
 if(!token)return failure('Add GROUPME_ACCESS_TOKEN as a Secret on the chatgpt Worker, then save and deploy.','SETUP',503);
 if(/[^\x21-\x7e]/.test(token))return failure('The saved token contains invalid characters. Copy only Your Access Token from GroupMe’s application page.','TOKEN_FORMAT',503);
 if(action==='audio')return groupmeAudio(request,token,networkFetch);
 if(action==='upload'&&request.method==='POST'){
  if(request.headers.get('Origin')!==url.origin)return failure('Invalid origin.','ORIGIN',403);
  const type=request.headers.get('Content-Type');if(!['image/jpeg','image/png','image/gif','image/webp'].includes(type))return failure('Choose a JPG, PNG, GIF or WebP photo.','FILE_TYPE',400);
  if(Number(request.headers.get('Content-Length'))>8000000)return failure('Photo must be under 8 MB.','FILE_SIZE',413);
  try{const bytes=await request.arrayBuffer();if(!bytes.byteLength||bytes.byteLength>8000000)return failure('Photo must be under 8 MB.','FILE_SIZE',413);
   const result=await networkFetch(new Request('https://image.groupme.com/pictures',{method:'POST',headers:{'X-Access-Token':token,'Content-Type':type},body:bytes,redirect:'manual',signal:AbortSignal.timeout(25000)}));if(!result.ok)return failure('GroupMe could not upload this photo.','UPLOAD');const data=await result.json(),photo=new URL(data.payload?.url||data.payload?.picture_url);if(photo.origin!=='https://i.groupme.com'||photo.username||photo.password)throw Error();return reply({response:{url:photo.href}});
  }catch{return failure('Photo upload failed. Your message was not sent.','UPLOAD')}
 }
 if(action==='live')return groupmeLive(request,token,networkFetch);
 let path,body,deleteTarget,reactionTarget;
 if(request.method==='GET'&&action==='status')path='/v3/users/me';
 else if(request.method==='GET'&&['groups','chats'].includes(action)){
  const page=Number(url.searchParams.get('page')||1);if(!Number.isInteger(page)||page<1||page>100)return failure('Invalid page.','INPUT',400);
  path='/v3/'+(action==='chats'?'chats':'groups')+'?per_page=100&page='+page;
 }else if(request.method==='GET'&&['messages','direct-messages'].includes(action)){
  const id=url.searchParams.get(action==='direct-messages'?'user':'group'),before=url.searchParams.get('before');
  if(!/^\d{1,30}$/.test(id||'')||(before&&!/^\d{1,40}$/.test(before)))return failure('Invalid conversation.','INPUT',400);
  path=action==='direct-messages'?'/v3/direct_messages?other_user_id='+id+'&limit=40':'/v3/groups/'+id+'/messages?limit=40';path+=(before?'&before_id='+before:'');
 }else if(request.method==='POST'&&action==='delete'){
  if(request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.startsWith('application/json'))return failure('Request origin was rejected.','ORIGIN',403);
  try{const raw=await request.text();if(raw.length>2000)return failure('Invalid message.','INPUT',400);deleteTarget=JSON.parse(raw);if(!/^\d{1,30}$/.test(deleteTarget?.group||'')||!/^\d{1,40}$/.test(deleteTarget?.message||''))return failure('Invalid message.','INPUT',400)}catch{return failure('Invalid message.','INPUT',400)}
  path='/v3/conversations/'+deleteTarget.group+'/messages/'+deleteTarget.message;
 }else if(request.method==='POST'&&action==='react'){
  if(request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.startsWith('application/json'))return failure('Request origin was rejected.','ORIGIN',403);
  try{const raw=await request.text();if(raw.length>2000)return failure('Invalid reaction.','INPUT',400);const data=JSON.parse(raw);
   if(!/^\d{1,30}$/.test(data?.group||'')||!/^\d{1,40}$/.test(data?.message||'')||typeof data.liked!=='boolean')return failure('Invalid reaction.','INPUT',400);
   const emoji=data.emoji||'❤️';if(!GROUPME_EMOJI.includes(emoji))return failure('GroupMe supports these 15 reaction emoji only.','REACTION_EMOJI',400);reactionTarget={...data,emoji};if(data.liked)body={like_icon:{type:'unicode',code:emoji}};path='/v3/messages/'+data.group+'/'+data.message+'/'+(data.liked?'like':'unlike');
  }catch{return failure('Invalid reaction.','INPUT',400)}
 }else if(request.method==='POST'&&action==='send'){
  if(request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.startsWith('application/json'))return failure('Request origin was rejected.','ORIGIN',403);
  if(Number(request.headers.get('Content-Length'))>16000)return failure('Message is too large.','INPUT',413);
  try{const raw=await request.text();if(raw.length>16000)return failure('Message is too large.','INPUT',413);body=JSON.parse(raw)}catch{return failure('Invalid message.','INPUT',400)}
  const target=body?.group;
  if(!/^\d{1,30}$/.test(target||'')||typeof body.text!=='string'||(!body.text.trim()&&!body.attachments?.length)||body.text.length>1000||! /^[\w-]{8,80}$/.test(body.source||''))return failure('Choose a conversation and enter up to 1,000 characters.','INPUT',400);
  if(body.attachments!==undefined){
   if(!Array.isArray(body.attachments)||body.attachments.length>2)return failure('Invalid attachments.','INPUT',400);
   let media=0,mentions=0;
   for(const attachment of body.attachments){
    if(!attachment||typeof attachment!=='object')return failure('Invalid attachment.','INPUT',400);
    if(attachment.type==='mentions'){
     if(++mentions>1||!Array.isArray(attachment.user_ids)||!Array.isArray(attachment.loci)||!attachment.user_ids.length||attachment.user_ids.length>30||attachment.user_ids.length!==attachment.loci.length)return failure('Invalid mentions.','INPUT',400);
     for(let i=0;i<attachment.user_ids.length;i++){const locus=attachment.loci[i];if(!/^\d{1,30}$/.test(attachment.user_ids[i])||!Array.isArray(locus)||locus.length!==2||!locus.every(Number.isInteger)||locus[0]<0||locus[1]<1||locus[0]+locus[1]>body.text.trim().length||body.text.trim()[locus[0]]!=='@')return failure('Invalid mention range.','INPUT',400)}
    }else if(++media>1||!((attachment.type==='audio'&&audioURL(attachment.url))||(attachment.type==='image'&&typeof attachment.url==='string'&&/^https:\/\/i\.groupme\.com\/[^\s]+$/.test(attachment.url))))return failure('Invalid media attachment.','INPUT',400);
   }
  }
  path='/v3/groups/'+target+'/messages';body={message:{source_guid:body.source,text:body.text.trim(),...(body.attachments?.length?{attachments:body.attachments}:{})}};
 }else return failure('Unknown GroupMe action.','ROUTE',404);
 try{
  const signal=AbortSignal.timeout(15000);
  if(deleteTarget){
   const options={headers:{'X-Access-Token':token,Accept:'application/json'},redirect:'manual',signal};
   const account=await networkFetch(new Request(ORIGIN+'/v3/users/me',options));
   const recent=await networkFetch(new Request(ORIGIN+'/v3/groups/'+deleteTarget.group+'/messages?limit=100',options));
   if(!account.ok||!recent.ok)return failure('Could not verify message ownership. Nothing was deleted.','DELETE_VERIFY');
   const user=(await account.json()).response,list=(await recent.json()).response?.messages;
   const message=Array.isArray(list)?list.find(m=>String(m.id)===deleteTarget.message):null;
   if(!message||!user?.id||String(message.user_id)!==String(user.id))return failure('You can delete only your own messages from the latest 100 messages. Nothing was deleted.','DELETE_NOT_OWN',403);
  }
  const upstream=new Request(ORIGIN+path,{method:deleteTarget?'DELETE':(reactionTarget||body)?'POST':'GET',headers:{'X-Access-Token':token,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'manual',signal});
  const response=await networkFetch(upstream);
  if(response.status===304&&['messages','direct-messages'].includes(action))return reply({response:action==='direct-messages'?{direct_messages:[]}:{messages:[]}});
  if(!response.ok){
   if(response.status===401)return failure('GroupMe rejected the saved token. Copy Your Access Token (not Client ID), replace the Worker secret, and deploy.','TOKEN_REJECTED');
   if(response.status===403){
    let detail='';try{
     const raw=await response.text();if(raw.length<=16000){const data=JSON.parse(raw);const errors=data?.meta?.errors;
      if(Array.isArray(errors))detail=errors.filter(value=>typeof value==='string').slice(0,3).join(' ');
     }
    }catch{}
    for(const secret of [token,encodeURIComponent(token)])detail=detail.split(secret).join('[redacted]');
    detail=detail.replace(/https?:\/\/[^\s]+/gi,'[link]').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,350);
    const actionLabel=action==='send'?'sending this group message':'access to this conversation';
    return failure('GroupMe denied '+actionLabel+'.'+(detail?' GroupMe says: '+detail:' GroupMe supplied no readable reason. Check the account and recipient permissions.'),'PERMISSION_DENIED',403);
   }
   if(response.status===429)return failure('GroupMe is limiting requests. Wait a minute before reconnecting.','RATE_LIMIT',429);
   return failure(`GroupMe returned HTTP ${response.status}.`,response.status>=300&&response.status<400?'REDIRECT':'UPSTREAM_HTTP');
  }
  if(reactionTarget){
   let acknowledgement;try{const raw=await response.text();if(raw)acknowledgement=JSON.parse(raw)}catch{}
   const icons=acknowledgement?.response?.reactions||acknowledgement?.reactions;
   const emojiConfirmed=reactionTarget.liked&&Array.isArray(icons)&&icons.some(icon=>icon.type==='unicode'&&icon.code===reactionTarget.emoji);
   const options={headers:{'X-Access-Token':token,Accept:'application/json'},redirect:'manual',signal};
   const account=await networkFetch(new Request(ORIGIN+'/v3/users/me',options));
   const history=await networkFetch(new Request(ORIGIN+'/v3/groups/'+reactionTarget.group+'/messages?limit=100',options));
   if((!account.ok||!history.ok)&&emojiConfirmed)return reply({response:{confirmed:true,message_id:String(reactionTarget.message),emoji:reactionTarget.emoji}});
   if(!account.ok||!history.ok)return failure('GroupMe accepted the reaction request, but its saved state could not be checked. Refresh the conversation before trying again.','REACTION_UNCONFIRMED');
   const user=(await account.json()).response,list=(await history.json()).response?.messages;
   const message=Array.isArray(list)?list.find(m=>String(m.id)===String(reactionTarget.message)):null;
   if((!user?.id||!message||!Array.isArray(message.favorited_by))&&emojiConfirmed)return reply({response:{confirmed:true,message_id:String(reactionTarget.message),emoji:reactionTarget.emoji}});
   if(!user?.id||!message||!Array.isArray(message.favorited_by))return failure('The reaction could not be verified in GroupMe’s latest 100 messages. No local reaction was added.','REACTION_UNCONFIRMED');
   const favorites=message.favorited_by.map(String),liked=favorites.includes(String(user.id));
   if((reactionTarget.liked&&reactionTarget.emoji!=='❤️'&&!emojiConfirmed)||(!emojiConfirmed&&liked!==reactionTarget.liked))return failure('GroupMe has not confirmed this reaction. No local reaction was added. Refresh the conversation before trying again.','REACTION_UNCONFIRMED');
   return reply({response:{confirmed:true,message_id:String(message.id),favorited_by:favorites,emoji:reactionTarget.liked?reactionTarget.emoji:null}});
  }
  if(action==='delete')return reply({response:{ok:true}});
  let data;try{data=await response.json()}catch{return failure('GroupMe returned an unreadable response.','RESPONSE_FORMAT')}
  if(!data||!Object.hasOwn(data,'response'))return failure('GroupMe returned an unexpected response.','RESPONSE_SHAPE');
  if(action==='status'){
   if(!data.response?.id||typeof data.response?.name!=='string')return failure('GroupMe returned no account profile.','ACCOUNT');
   return reply({response:{name:data.response.name,id:String(data.response.id)}});
  }
  return reply({response:data.response});
 }catch(error){return failure('The Worker could not complete the GroupMe request. No token change is needed unless TOKEN_REJECTED appears.','TRANSPORT_'+reason(error))}
}
