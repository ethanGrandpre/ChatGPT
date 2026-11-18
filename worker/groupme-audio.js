const TYPES={'audio/x-m4a':'m4a','audio/aac':'aac','audio/x-wav':'wav','audio/webm':'webm','audio/mp4':'m4a','audio/mpeg':'mp3','audio/ogg':'ogg','audio/wav':'wav'};
export function audioURL(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['m.groupme.com','v.groupme.com','a.groupme.com'].includes(u.hostname)?u.href:null}catch{return null}}
export async function groupmeAudio(request,token,network){
 const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}}),url=new URL(request.url);
 let stage='validation';
 try{
 if(request.method==='GET'){
  const target=audioURL(url.searchParams.get('url'));if(!target)return reply({error:'Invalid audio URL.'},400);
  const response=await network(new Request(target,{headers:{Cookie:'token='+token,...(request.headers.get('Range')?{Range:request.headers.get('Range')}:{})},redirect:'manual',signal:AbortSignal.timeout(25000)}));if(!response.ok)return reply({error:'GroupMe could not load the audio.'},502);
  const headers=new Headers({'Content-Type':Object.keys(TYPES).includes(response.headers.get('Content-Type')?.split(';')[0])?response.headers.get('Content-Type'):'audio/mp4','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});for(const name of ['Content-Length','Content-Range','Accept-Ranges'])if(response.headers.has(name))headers.set(name,response.headers.get(name));return new Response(response.body,{status:response.status,headers});
 }
 if(request.method!=='POST')return reply({error:'Method not allowed.'},405);
 if(request.headers.get('Origin')!==url.origin)return reply({error:'Invalid origin.'},403);
 const type=request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase(),extension=TYPES[type],group=url.searchParams.get('group');if(!extension||!/^\d{1,30}$/.test(group||''))return reply({error:'Choose a supported audio file and a group.'},400);
 if(Number(request.headers.get('Content-Length'))>8000000)return reply({error:'Audio must be under 8 MB.'},413);const bytes=await request.arrayBuffer();if(!bytes.byteLength||bytes.byteLength>8000000)return reply({error:'Audio must be under 8 MB.'},413);
 const options={headers:{'X-Access-Token':token},redirect:'manual',signal:AbortSignal.timeout(25000)};
 stage='account check';const profile=await network(new Request('https://api.groupme.com/v3/users/me',options));if(!profile.ok)throw Error('HTTP '+profile.status);const user=String((await profile.json()).response?.id||'');if(!/^\d{1,30}$/.test(user))throw Error();
 stage='upload session';let session=await network(new Request('https://m.groupme.com/uploads',{...options,method:'POST',headers:{...options.headers,'Content-Type':'application/json'},body:JSON.stringify({fileSize:String(bytes.byteLength),senderId:user,extension,groupId:group})}));if(session.status===400)session=await network(new Request('https://m.groupme.com/uploads',{...options,method:'POST',headers:{...options.headers,'Content-Type':'application/json'},body:JSON.stringify({FileSize:bytes.byteLength,SenderId:user,Extension:extension,groupId:group})}));if(!session.ok)throw Error('HTTP '+session.status);const data=await session.json(),upload=new URL(data.uploadUrl),render=audioURL(data.renderUrl);
 stage='upload destination';if(!render||upload.protocol!=='https:'||upload.username||upload.password||upload.port||!(/^[a-z0-9-]+\.blob\.core\.windows\.net$/.test(upload.hostname)||upload.hostname==='m.groupme.com'))throw Error();
 stage='audio transfer';let destination=upload,stored;
 for(let hop=0;hop<4;hop++){
  if(destination.protocol!=='https:'||destination.username||destination.password||destination.port||!(/^[a-z0-9-]+\.blob\.core\.windows\.net$/.test(destination.hostname)||destination.hostname==='m.groupme.com'))throw Error();
  stored=await network(new Request(destination.href,{method:'PUT',headers:{'Content-Type':type,'x-ms-blob-type':'BlockBlob'},body:bytes,redirect:'manual',signal:AbortSignal.timeout(25000)}));
  if([307,308].includes(stored.status)){destination=new URL(stored.headers.get('Location'),destination);continue}break;
 }
 if(!stored?.ok)throw Error('HTTP '+stored?.status);return reply({response:{url:render},release:'groupme-notify-emoji-1'});
 }catch(error){const code=/^HTTP \d{3}$/.test(error.message)?' ('+error.message+')':'';return reply({error:'GroupMe '+stage+' failed'+code+'. Your clip can be retried; no message was sent.',release:'groupme-notify-emoji-1'},502)}
}
