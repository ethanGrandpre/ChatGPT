const TYPES={'audio/x-m4a':'m4a','audio/aac':'aac','audio/x-wav':'wav','audio/webm':'webm','audio/mp4':'m4a','audio/mpeg':'mp3','audio/ogg':'ogg','audio/wav':'wav'};
const MEDIA_HOSTS=new Set(['m.groupme.com','v.groupme.com','a.groupme.com']);
const UPLOAD_HOSTS=new Set(['m.groupme.com','cdn2.groupme.com']);
const DESTINATION_REASONS={SCHEME:'unsupported URL scheme',HOST:'unrecognized destination host',CREDENTIALS:'URL contains credentials',PORT:'unexpected network port',URL:'invalid or missing URL',SHAPE:'missing upload or playback URL'};
class AudioDestinationError extends Error{constructor(kind,reason){super('Invalid audio destination');this.audioCode='GM_AUDIO_'+kind+'_'+reason;this.detail=DESTINATION_REASONS[reason]}}
function destinationURL(value,kind){let url;try{if(typeof value!=='string'||!value.trim())throw Error();url=new URL(value.startsWith('//')?'https:'+value:value)}catch{throw new AudioDestinationError(kind,'URL')}
 if(!['http:','https:'].includes(url.protocol))throw new AudioDestinationError(kind,'SCHEME');
 if(url.username||url.password)throw new AudioDestinationError(kind,'CREDENTIALS');
 if(url.port)throw new AudioDestinationError(kind,'PORT');
 const trusted=kind==='RENDER'?MEDIA_HOSTS.has(url.hostname):UPLOAD_HOSTS.has(url.hostname)||/^[a-z0-9-]+\.blob\.core\.windows\.net$/.test(url.hostname);
 if(!trusted){const error=new AudioDestinationError(kind,'HOST');if(kind==='UPLOAD')error.destinationHost=url.hostname;throw error}
 // Legacy GroupMe links may advertise HTTP. Always contact the fixed trusted host over HTTPS.
 url.protocol='https:';return url;
}
export function audioURL(value){try{return destinationURL(value,'RENDER').href}catch{return null}}
function sessionURLs(data){const session=[data,data?.response,data?.payload].find(value=>value&&typeof value.uploadUrl==='string'&&typeof value.renderUrl==='string');if(!session)throw new AudioDestinationError('SESSION','SHAPE');return {upload:destinationURL(session.uploadUrl,'UPLOAD'),render:destinationURL(session.renderUrl,'RENDER').href}}
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
 stage='upload session';let session=await network(new Request('https://m.groupme.com/uploads',{...options,method:'POST',headers:{...options.headers,'Content-Type':'application/json'},body:JSON.stringify({fileSize:String(bytes.byteLength),senderId:user,extension,groupId:group})}));if(session.status===400)session=await network(new Request('https://m.groupme.com/uploads',{...options,method:'POST',headers:{...options.headers,'Content-Type':'application/json'},body:JSON.stringify({FileSize:bytes.byteLength,SenderId:user,Extension:extension,groupId:group})}));if(!session.ok)throw Error('HTTP '+session.status);const data=await session.json();
 stage='upload destination';const {upload,render}=sessionURLs(data);
 stage='audio transfer';let destination=upload,stored;
 for(let hop=0;hop<4;hop++){
  destination=destinationURL(destination.href,'UPLOAD');
  stored=await network(new Request(destination.href,{method:'PUT',headers:{'Content-Type':type,'x-ms-blob-type':'BlockBlob'},body:bytes,redirect:'manual',signal:AbortSignal.timeout(25000)}));
  if([307,308].includes(stored.status)){const location=stored.headers.get('Location');if(!location)throw new AudioDestinationError('UPLOAD','URL');destination=destinationURL(new URL(location,destination).href,'UPLOAD');continue}break;
 }
 if(!stored?.ok)throw Error('HTTP '+stored?.status);return reply({response:{url:render},release:'groupme-notify-emoji-1'});
 }catch(error){const diagnostic=error instanceof AudioDestinationError?' ('+error.detail+') ['+error.audioCode+']'+(error.destinationHost?' Host: '+error.destinationHost:''):'';const code=/^HTTP \d{3}$/.test(error.message)?' ('+error.message+')':'';return reply({error:'GroupMe '+stage+' failed'+code+diagnostic+'. Your clip can be retried; no message was sent.',release:'groupme-notify-emoji-1',...(error instanceof AudioDestinationError?{code:error.audioCode,...(error.destinationHost?{destinationHost:error.destinationHost}:{})}:{})},502)}
}
