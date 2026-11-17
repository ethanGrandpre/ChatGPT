/* Shared, dependency-free calendar rules for page, service worker and server. */
(()=>{
 const frequencies=['none','daily','weekdays','weekly','monthly'],formatters=new Map(),zoneNames=new Map();
 function zone(value){if(typeof value!=='string'||value.length>80)throw Error('Choose a valid reminder time zone.');if(zoneNames.has(value))return zoneNames.get(value);const name=new Intl.DateTimeFormat('en',{timeZone:value}).resolvedOptions().timeZone;if(zoneNames.size>=64)zoneNames.clear();zoneNames.set(value,name);return name}
 function formatter(timeZone){if(!formatters.has(timeZone)){if(formatters.size>=32)formatters.clear();formatters.set(timeZone,new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}))}return formatters.get(timeZone)}
 function parts(at,timeZone){const result={};for(const p of formatter(timeZone).formatToParts(new Date(at)))if(p.type!=='literal')result[p.type]=Number(p.value);return{y:result.year,m:result.month,d:result.day,h:result.hour,min:result.minute}}
 const utc=p=>Date.UTC(p.y,p.m-1,p.d,p.h||0,p.min||0);
 function localEpoch(p,timeZone){const desired=utc(p),offsets=new Set();for(const delta of [-36,-12,0,12,36]){const sample=desired+delta*3600000;offsets.add(utc(parts(sample,timeZone))-sample)}const candidates=[...offsets].map(offset=>desired-offset),exact=candidates.filter(value=>utc(parts(value,timeZone))===desired);if(exact.length)return Math.min(...exact);const forward=candidates.filter(value=>utc(parts(value,timeZone))>desired).sort((a,b)=>utc(parts(a,timeZone))-utc(parts(b,timeZone)));if(!forward.length)throw Error('Could not resolve reminder time.');return forward[0]}
 function fromLocal(value,timeZone){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Choose a valid reminder date and time.');const[y,m,d,h,min]=value.split(/[-T:]/).map(Number),date=new Date(Date.UTC(y,m-1,d));if(date.getUTCFullYear()!==y||date.getUTCMonth()+1!==m||date.getUTCDate()!==d||h>23||min>59)throw Error('Choose a valid reminder date and time.');return localEpoch({y,m,d,h,min},zone(timeZone))}
 function toLocal(at,timeZone){const p=parts(at,timeZone);return`${p.y}-${String(p.m).padStart(2,'0')}-${String(p.d).padStart(2,'0')}T${String(p.h).padStart(2,'0')}:${String(p.min).padStart(2,'0')}`}
 function next(anchor,frequency='none',timeZone='UTC',after=Date.now()){
  if(!Number.isFinite(anchor)||!Number.isFinite(after)||!frequencies.includes(frequency))throw Error('Invalid recurring reminder.');if(frequency==='none')return anchor>after?anchor:null;
  const a=parts(anchor,timeZone),b=parts(after,timeZone),start=Math.max(Date.UTC(a.y,a.m-1,a.d),Date.UTC(b.y,b.m-1,b.d)),weekday=new Date(Date.UTC(a.y,a.m-1,a.d)).getUTCDay();
  if(frequency==='monthly'){const first=Math.max(a.y*12+a.m-1,b.y*12+b.m-1);for(let i=0;i<4;i++){const index=first+i,y=Math.floor(index/12),m=index%12+1,d=Math.min(a.d,new Date(Date.UTC(y,m,0)).getUTCDate()),at=localEpoch({y,m,d,h:a.h,min:a.min},timeZone);if(at>=anchor&&at>after)return at}}
  else for(let i=0;i<15;i++){const date=new Date(start+i*86400000),day=date.getUTCDay();if(frequency==='weekdays'&&(day===0||day===6)||frequency==='weekly'&&day!==weekday)continue;const at=localEpoch({y:date.getUTCFullYear(),m:date.getUTCMonth()+1,d:date.getUTCDate(),h:a.h,min:a.min},timeZone);if(at>=anchor&&at>after)return at}
  throw Error('Could not find the next reminder.');
 }
 function due(anchor,frequency='none',timeZone='UTC',now=Date.now(),shown=null){if(frequency==='none')return anchor<=now&&shown!==anchor?anchor:null;const window=frequency==='monthly'?65:frequency==='weekly'?15:10;let value=next(anchor,frequency,timeZone,now-window*86400000),latest=null;for(let i=0;i<70&&value!==null&&value<=now;i++){latest=value;value=next(anchor,frequency,timeZone,value)}return latest!==null&&(shown===null||shown===undefined||latest>shown)?latest:null}
 const labels={none:'Does not repeat',daily:'Every day',weekdays:'Weekdays',weekly:'Every week',monthly:'Every month'};
 globalThis.DockTaskRecurrence={frequencies,zone,parts,fromLocal,toLocal,next,due,labels};
})();
