export const sendStyles=['glide','arc','spring','flip','comet','off'];
export function flightFrames(style,dx,dy){
 const start={transform:`translate(${dx}px,${dy}px) scale(.88)`,opacity:.65},end={transform:'translate(0,0) scale(1)',opacity:1};
 if(style==='arc')return[start,{transform:`translate(${dx*.5-45}px,${dy*.5-35}px) rotate(-6deg) scale(.95)`,opacity:1},end];
 if(style==='spring')return[start,{transform:'translate(0,-10px) scale(1.03)',offset:.8,opacity:1},end];
 if(style==='flip')return[{...start,transform:`translate(${dx}px,${dy}px) rotate(-12deg) scale(.65)`},{transform:`translate(${dx*.4}px,${dy*.4}px) rotate(5deg) scale(.9)`,opacity:1},end];
 if(style==='comet')return[{...start,filter:'blur(2px)'},{transform:`translate(${dx*.4}px,${dy*.4}px) scale(1.04,.9)`,filter:'blur(0)',opacity:1},{...end,filter:'blur(0)'}];
 return[start,end];
}
let active;
async function play(id,origin,style){
 active?.();if(!id||!origin||style==='off'||!sendStyles.includes(style)||document.documentElement.dataset.groupmeMotion==='quick'||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
 const row=Array.from(document.querySelectorAll('#messages .message')).find(node=>node.dataset.messageId===String(id)),bubble=row?.querySelector('p');if(!bubble||!bubble.animate)return;
 const bounds=bubble.getBoundingClientRect(),ghost=bubble.cloneNode(true);ghost.className='send-flight';Object.assign(ghost.style,{position:'fixed',left:bounds.left+'px',top:bounds.top+'px',width:bounds.width+'px',height:bounds.height+'px',margin:'0',boxSizing:'border-box',pointerEvents:'none',zIndex:'1000'});ghost.setAttribute('aria-hidden','true');document.body.append(ghost);const old=bubble.style.visibility;bubble.style.visibility='hidden';
 const clean=()=>{ghost.remove();bubble.style.visibility=old;if(active===clean)active=null};active=clean;
 try{await ghost.animate(flightFrames(style,origin.left-bounds.left,origin.top-bounds.top),{duration:style==='spring'?500:380,easing:'cubic-bezier(.2,.7,.2,1)',fill:'both'}).finished}catch{}finally{clean()}
}
if(typeof window!=='undefined'){window.DockGroupMeSendMotion={play};window.addEventListener('pagehide',()=>active?.())}
