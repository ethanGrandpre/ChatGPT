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

let active,sequence=0;
async function play(id,origin,style){
 const run=++sequence;active?.();if(!id||!origin||style==='off'||!sendStyles.includes(style)||document.documentElement.dataset.groupmeMotion==='quick'||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
 const row=Array.from(document.querySelectorAll('#messages .message')).find(node=>node.dataset.messageId===String(id)),bubble=row?.querySelector('p');if(!bubble||!bubble.animate)return;
 const old=bubble.style.visibility;let ghost,animation,cleaned=false;const clean=()=>{if(cleaned)return;cleaned=true;animation?.cancel();ghost?.remove();bubble.style.visibility=old;window.visualViewport?.removeEventListener('resize',clean);window.visualViewport?.removeEventListener('scroll',clean);window.removeEventListener('resize',clean);if(active===clean)active=null};active=clean;bubble.style.visibility='hidden';
 try{
  const start=await settledComposerOrigin(origin);if(run!==sequence||!start||!bubble.isConnected||document.visibilityState==='hidden')return;
  const bounds=bubble.getBoundingClientRect();ghost=bubble.cloneNode(true);ghost.className='send-flight';Object.assign(ghost.style,{position:'fixed',left:bounds.left+'px',top:bounds.top+'px',width:bounds.width+'px',height:bounds.height+'px',margin:'0',boxSizing:'border-box',pointerEvents:'none',zIndex:'1000',visibility:'visible'});ghost.setAttribute('aria-hidden','true');document.body.append(ghost);
  window.visualViewport?.addEventListener('resize',clean);window.visualViewport?.addEventListener('scroll',clean);window.addEventListener('resize',clean);
  animation=ghost.animate(flightFrames(style,start.left-bounds.left,start.top-bounds.top,bounds.left>innerWidth-bounds.right?-Math.min(80,bounds.left-8):Math.min(80,innerWidth-bounds.right-8)),{duration:SEND_DURATION,easing:'ease-in-out',fill:'both'});await animation.finished;
 }catch{}finally{clean()}
}

if(typeof window!=='undefined'){window.DockGroupMeSendMotion={play};window.addEventListener('pagehide',()=>{sequence++;active?.()});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){sequence++;active?.()}})}

// Measure in the same settled viewport as the destination, never from before keyboard dismissal.
export async function settledComposerOrigin(origin){
 const read=()=>{try{return typeof origin==='function'?origin():origin}catch{return null}};
 if(!matchMedia('(pointer:coarse)').matches){await new Promise(requestAnimationFrame);return read()}
 const started=performance.now();let changed=started,last='';
 return new Promise(resolve=>{function sample(){const now=performance.now(),rect=read(),viewport=window.visualViewport;if(!rect){resolve(null);return}const key=[rect.left,rect.top,rect.width,rect.height,viewport?.height,viewport?.offsetTop,innerHeight].map(value=>Math.round(Number(value)||0)).join(':');if(key!==last){last=key;changed=now}if(now-started>=800||now-started>=200&&now-changed>=140){resolve(rect);return}requestAnimationFrame(sample)}requestAnimationFrame(sample)})
}
