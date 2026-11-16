export const $=s=>document.querySelector(s);
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function load(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
export function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{notify('Could not save on this device. Export a backup before closing.');return false}}
export function notify(text,undo){let el=$('#toast');if(!el){el=document.createElement('div');el.id='toast';el.setAttribute('role','status');document.body.append(el)}el.textContent=text;if(undo){const button=document.createElement('button');button.textContent='Undo';button.onclick=()=>{undo();el.classList.remove('show')};el.append(button)}el.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.classList.remove('show'),7000)}
export function download(name,text,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
export function dateKey(d=new Date()){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value}
export function initTheme(){document.documentElement.classList.toggle('dark',load('dock-v1',{}).theme==='dark');document.querySelectorAll('[data-theme-toggle]').forEach(b=>b.onclick=()=>{const state=load('dock-v1',{});state.theme=document.documentElement.classList.toggle('dark')?'dark':'light';save('dock-v1',state)})}
initTheme();
