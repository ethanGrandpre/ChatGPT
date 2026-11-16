/* Shared appearance only. Project records remain separate and browser-local. */
(()=>{
 const KEY='dock-v1',modes=['system','light','dark'],accents=['neutral','blue','sage','violet','rose','amber'];
 const media=matchMedia('(prefers-color-scheme: dark)');
 function read(){try{const s=JSON.parse(localStorage.getItem(KEY)||'{}');return s&&typeof s==='object'&&!Array.isArray(s)?s:{}}catch{return{}}}
 function normalize(s={}){return{theme:modes.includes(s.theme)?s.theme:'system',accent:accents.includes(s.accent)?s.accent:'neutral'}}
 let current=normalize(read());
 function isDark(){return current.theme==='dark'||current.theme==='system'&&media.matches}
 function apply(s=read()){current=normalize(s);const root=document.documentElement;root.classList.toggle('dark',isDark());root.dataset.accent=current.accent;root.dataset.mode=current.theme;const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=isDark()?'#000000':'#ffffff';document.dispatchEvent(new CustomEvent('dock-appearance',{detail:{...current,dark:isDark()}}));return current}
 function update(patch){const s={...read(),...patch};try{localStorage.setItem(KEY,JSON.stringify(s))}catch{}apply(s);return s}
 function toggleTheme(){return update({theme:isDark()?'light':'dark'})}
 window.DockAppearance={read,normalize,apply,update,toggleTheme,isDark,accents,modes};
 media.addEventListener('change',()=>{if(current.theme==='system')apply({...read(),theme:'system'})});
 window.addEventListener('storage',e=>{if(e.key===KEY||e.key===null)apply()});
 apply();document.addEventListener('DOMContentLoaded',()=>apply());
})();
