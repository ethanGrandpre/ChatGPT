// Shared by the hub and child pages. Only the outer Desktop needs the badge.
(()=>{
 if(window.top!==window.self)return;
 const infoURL=new URL('build-info.json',document.currentScript.src);
 async function start(){
  let info;try{const response=await fetch(infoURL,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(8000)});if(!response.ok)return;info=await response.json()}catch{return}
  const timestamp=Date.parse(info.builtAt);if(!Number.isFinite(timestamp))return;
  const tag=document.createElement('div');tag.id='dock-deployment-status';
  tag.title=`Build created ${new Date(timestamp).toLocaleString()}${info.commit?' · '+info.commit:''}. Age is measured from build creation, not Cloudflare deployment completion.`;
  tag.style.cssText='position:fixed;z-index:9998;left:max(10px,env(safe-area-inset-left));bottom:calc(8px + env(safe-area-inset-bottom));max-width:calc(100vw - 24px);padding:4px 7px;border:1px solid var(--line,#ddd);border-radius:5px;background:var(--bg,#fff);color:var(--muted,#777);font:9px/1.4 system-ui,sans-serif;pointer-events:none;opacity:.8';
  if(document.getElementById('desktop'))tag.style.bottom='calc(78px + env(safe-area-inset-bottom))';
  document.body.append(tag);
  function update(){const seconds=Math.max(0,Math.floor((Date.now()-timestamp)/1000));const age=seconds<60?`${seconds} sec`:seconds<3600?`${Math.floor(seconds/60)} min`:seconds<86400?`${Math.floor(seconds/3600)} hr`:`${Math.floor(seconds/86400)} day`;tag.textContent=`Cloudflare build · ${age} ago`}
  update();setInterval(()=>{if(document.visibilityState==='visible')update()},1000);document.addEventListener('visibilitychange',update);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
