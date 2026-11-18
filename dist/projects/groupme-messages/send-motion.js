export const sendStyles=['glide','arc','spring','flip','comet','off'];
export const SEND_DURATION=560;
export function flightFrames(style,dx,dy,bend=-80){
 const end={transform:'translate(0,0) scale(1)',opacity:1},start={transform:`translate(${dx}px,${dy}px) scale(1)`,opacity:1};
 if(style==='arc')return [0,.25,.5,.75,1].map(t=>t===1?{...end,offset:1}:{transform:`translate(${dx*(1-t)+Math.sin(Math.PI*t)*bend}px,${dy*(1-t)}px) rotate(${Math.sin(Math.PI*t)*-16}deg) scale(1)`,opacity:1,offset:t});
 if(style==='spring')return[start,{transform:'translate(0,-32px) scale(.9,1.15)',offset:.55,opacity:1},{transform:'translate(0,12px) scale(1.15,.8)',offset:.75,opacity:1},{transform:'translate(0,-7px) scale(.97,1.04)',offset:.9,opacity:1},end];
 if(style==='flip')return[{...start,transform:`translate(${dx}px,${dy}px) perspective(600px) rotateY(-180deg) scale(.75)`},{transform:`translate(${dx*.5}px,${dy*.5}px) perspective(600px) rotateY(-90deg) scale(.9)`,offset:.45,opacity:1},{transform:'translate(0,0) perspective(600px) rotateY(15deg) scale(1)',offset:.85,opacity:1},end];
 if(style==='comet')return[{...start,transform:`translate(${dx}px,${dy}px) scale(.4,.25)`,filter:'blur(1px)',boxShadow:'0 22px 0 -4px var(--accent),0 42px 0 -7px var(--accent)'},{transform:`translate(${dx*.4}px,${dy*.4}px) scale(1.4,.3)`,offset:.5,filter:'blur(0)',boxShadow:'0 18px 0 -4px var(--accent),0 34px 0 -7px var(--accent)',opacity:1},{transform:'translate(0,0) scale(1.08,.85)',offset:.85,filter:'blur(0)',boxShadow:'0 0 0 0 transparent',opacity:1},{...end,filter:'blur(0)',boxShadow:'0 0 0 0 transparent'}];
 return[start,end];
}

let active;
async function play(id,origin,style){
 active?.();if(!id||!origin||style==='off'||!sendStyles.includes(style)||document.documentElement.dataset.groupmeMotion==='quick'||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
 const row=Array.from(document.querySelectorAll('#messages .message')).find(node=>node.dataset.messageId===String(id)),bubble=row?.querySelector('p');if(!bubble||!bubble.animate)return;
 const bounds=bubble.getBoundingClientRect(),ghost=bubble.cloneNode(true);ghost.className='send-flight';Object.assign(ghost.style,{position:'fixed',left:bounds.left+'px',top:bounds.top+'px',width:bounds.width+'px',height:bounds.height+'px',margin:'0',boxSizing:'border-box',pointerEvents:'none',zIndex:'1000'});ghost.setAttribute('aria-hidden','true');document.body.append(ghost);const old=bubble.style.visibility;bubble.style.visibility='hidden';
 const clean=()=>{ghost.remove();bubble.style.visibility=old;if(active===clean)active=null};active=clean;
 try{await ghost.animate(flightFrames(style,origin.left-bounds.left,origin.top-bounds.top,bounds.left>innerWidth-bounds.right?-Math.min(80,bounds.left-8):Math.min(80,innerWidth-bounds.right-8)),{duration:SEND_DURATION,easing:'ease-in-out',fill:'both'}).finished}catch{}finally{clean()}
}
if(typeof window!=='undefined'){window.DockGroupMeSendMotion={play};window.addEventListener('pagehide',()=>active?.())}
