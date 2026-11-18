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
  const root=document.getElementById('messages');if(row===root?.querySelector('.message:last-child')&&root.scrollHeight-root.scrollTop-root.clientHeight<80)root.scrollTop=root.scrollHeight;
  const bounds=bubble.getBoundingClientRect();if(!bounds.width||!bounds.height)return;const viewport=window.visualViewport,geometry=flightGeometry(bounds,start,{left:viewport?.offsetLeft||0,top:viewport?.offsetTop||0,width:viewport?.width||innerWidth,height:viewport?.height||innerHeight});
  ghost=document.createElement('div');ghost.className='send-flight';const content=bubble.cloneNode(true);content.className='send-flight-bubble';copyBubbleStyle(bubble,content);Object.assign(content.style,{width:bounds.width+'px',height:'auto',minHeight:bounds.height+'px',maxHeight:'none',maxWidth:'none',margin:'0',boxSizing:'border-box',overflow:'visible',visibility:'visible',transform:'scale('+geometry.fit+')',transformOrigin:'top left'});for(const [i,link]of [...content.querySelectorAll('a')].entries()){const original=bubble.querySelectorAll('a')[i];if(original)link.style.color=getComputedStyle(original).color}
  Object.assign(ghost.style,{position:'fixed',left:geometry.left+'px',top:geometry.top+'px',width:geometry.width+'px',height:geometry.height+'px',margin:'0',padding:'0',border:'0',background:'transparent',boxSizing:'border-box',overflow:'visible',pointerEvents:'none',zIndex:'1000',visibility:'visible'});ghost.append(content);ghost.setAttribute('aria-hidden','true');ghost.inert=true;document.body.append(ghost);
  window.visualViewport?.addEventListener('resize',clean);window.visualViewport?.addEventListener('scroll',clean);window.addEventListener('resize',clean);
  animation=ghost.animate(flightFrames(style,geometry.startLeft-geometry.left,geometry.startTop-geometry.top,geometry.left>innerWidth-(geometry.left+geometry.width)?-Math.min(80,geometry.left-8):Math.min(80,innerWidth-geometry.left-geometry.width-8)),{duration:SEND_DURATION,easing:'ease-in-out',fill:'both'});await animation.finished;
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

function copyBubbleStyle(source,target){const style=getComputedStyle(source);for(const property of ['font-family','font-size','font-weight','font-style','font-stretch','font-variant','font-feature-settings','font-kerning','line-height','letter-spacing','word-spacing','white-space','word-break','overflow-wrap','hyphens','tab-size','text-align','text-indent','text-transform','text-rendering','text-decoration','text-size-adjust','-webkit-text-size-adjust','direction','writing-mode','padding','border','border-radius','background','color'])target.style.setProperty(property,style.getPropertyValue(property))}
export function flightGeometry(bounds,origin,viewport){const inset=12,left=viewport.left||0,top=viewport.top||0,right=left+viewport.width,bottom=top+viewport.height;const sourceBottom=Number.isFinite(origin.bottom)?origin.bottom:origin.top+(origin.height||44),targetBottom=Number.isFinite(bounds.bottom)?bounds.bottom:bounds.top+bounds.height;const available=Math.max(44,Math.min(bottom-inset,sourceBottom,targetBottom)-top-inset);const fit=Math.min(1,(viewport.width-inset*2)/bounds.width,available/bounds.height),width=bounds.width*fit,height=bounds.height*fit;const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));return{fit,width,height,left:clamp(bounds.left+bounds.width-width,left+inset,right-inset-width),top:clamp(targetBottom-height,top+inset,bottom-inset-height),startLeft:clamp(origin.left,left+inset,right-inset-width),startTop:clamp(sourceBottom-height,top+inset,bottom-inset-height)}}
