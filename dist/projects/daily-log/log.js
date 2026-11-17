import {$,esc,load,save,notify,download,dateKey,validDate} from '../../project-kit.js';
const KEY='dock-daily-log-v1',fields=['focus','wins','next-step','notes'];
let entries=load(KEY,{}),day=dateKey(),saveTimer=null,pending=null;
if(!entries||Array.isArray(entries)||typeof entries!=='object')entries={};
function hasContent(entry){return fields.some(field=>entry?.[field]?.trim())}
function renderDays(){const dates=Object.keys(entries).filter(date=>validDate(date)&&hasContent(entries[date])).sort().reverse();$('#days').innerHTML=dates.length?dates.map(date=>`<button data-day="${date}" class="${date===day?'active':''}">${date}</button>`).join(''):'<span class="day-empty">Saved days appear here.</span>';document.querySelectorAll('[data-day]').forEach(button=>button.onclick=()=>openDay(button.dataset.day))}
function readFields(){return Object.fromEntries(fields.map(field=>[field,$('#'+field).value]))}
function writeEntry(target,entry){const previous=entries[target];if(hasContent(entry))entries[target]={...entry,updated:Date.now()};else delete entries[target];const stored=save(KEY,entries);if(!stored){if(previous)entries[target]=previous;else delete entries[target]}if(target===day)$('#saved').textContent=stored?'Saved just now':'Not saved — export a backup';renderDays();return stored}
function flushPending(){if(!pending)return;clearTimeout(saveTimer);saveTimer=null;const queued=pending;pending=null;writeEntry(queued.day,queued.entry)}
function queueWrite(){pending={day,entry:readFields()};$('#saved').textContent='Saving…';clearTimeout(saveTimer);saveTimer=setTimeout(flushPending,350)}
function write(){if(pending){flushPending();return}writeEntry(day,readFields())}
function openDay(target){if(!validDate(target)){if($('#date'))$('#date').value=day;return}if(pending)flushPending();day=target;$('#date').value=day;const local=new Date(day+'T12:00:00');$('#weekday').textContent=local.toLocaleDateString(undefined,{weekday:'long'});for(const field of fields)$('#'+field).value=entries[day]?.[field]||'';$('#saved').textContent=hasContent(entries[day])?'Saved on this device':'A fresh page';renderDays()}
for(const field of fields)$('#'+field).oninput=queueWrite;
$('#date').onchange=event=>openDay(event.target.value);
for(const[id,offset]of[['previous',-1],['next',1]])$('#'+id).onclick=()=>{const date=new Date(day+'T12:00:00');date.setDate(date.getDate()+offset);openDay(dateKey(date))};
$('#today').onclick=()=>openDay(dateKey());
$('#clear').onclick=()=>{if(pending)flushPending();const old=entries[day];if(!old)return;const cleared=day;delete entries[cleared];if(!save(KEY,entries)){entries[cleared]=old;return}openDay(day);notify('Day cleared',()=>{entries[cleared]=old;if(save(KEY,entries))openDay(cleared)})};
$('#backup').onclick=()=>{if(pending)flushPending();download('daily-log-backup.json',JSON.stringify({version:1,entries},null,2))};
$('#export-day').onclick=()=>{if(pending)flushPending();const entry=entries[day]||{};download(`daily-log-${day}.md`,`# ${day}\n\n`+fields.map(field=>`## ${field==='next-step'?'Next step':field[0].toUpperCase()+field.slice(1)}\n\n${entry[field]||''}`).join('\n\n'),'text/markdown')};
$('#restore').onclick=()=>$('#file').click();
$('#file').onchange=async event=>{try{if(pending)flushPending();const file=event.target.files[0];if(!file)return;if(file.size>6000000)throw Error();const data=JSON.parse(await file.text());if(data.version!==1||!data.entries||typeof data.entries!=='object'||Array.isArray(data.entries)||Object.keys(data.entries).length>1500)throw Error();for(const[date,entry]of Object.entries(data.entries)){if(!validDate(date)||!entry||fields.some(field=>typeof entry[field]!=='string'||entry[field].length>40000))throw Error()}const previous={...entries},added=Object.entries(data.entries).filter(([date])=>!entries[date]);for(const[date,entry]of added)entries[date]=entry;if(!save(KEY,entries)){entries=previous;return}openDay(day);notify(`Imported ${added.length} new days. Existing days were kept.`)}catch{notify('Choose a valid Daily Log backup (up to 6 MB).')}finally{event.target.value=''}};
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();write()}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushPending()});
window.addEventListener('pagehide',flushPending);
openDay(day);
