// Local, deliberately conservative cues, not an AI assessment of someone's mood.
export function sensitivityLevel(value){const n=Number(value);return Number.isFinite(n)?Math.max(1,Math.min(5,Math.round(n))):3}
export function contextEmotion(text,context=[],sensitivity=3){
 const raw=String(text||'');if(raw.length>600||/[`]|https?:\/\//i.test(raw)||/^\s*>/m.test(raw))return null;
 const t=raw.toLowerCase().replace(/[’']/g,'');
 // Never amplify grief, threats, negation or obvious sarcasm, even at high sensitivity.
 if(/\b(no|not|never|isnt|wasnt|dont|cant|wish|pretending|sarcasm|sarcastic|jk|kidding|died|death|funeral|suicide|kill|depressed)\b/.test(t)||/yeah right|as if|yay.*(?:more homework|another exam|another test)/.test(t))return null;
 const negative=/\b(sad|upset|angry|hate|died|death|funeral|failed|failure|lost|sick|hurt|unhappy|crying)\b/;
 const badContext=context.some(s=>negative.test(String(s).toLowerCase()));
 if(context.some(s=>/\b(died|death|funeral|suicide)\b/i.test(String(s))))return null;
 const clearWin=/\b(i|we) (won|passed|got (the job|accepted|promoted))\b/.test(t);
 const threshold=6-sensitivityLevel(sensitivity),boost=/!!|[A-Z]{4,}/.test(raw)?1:0;
 const rules=[
 ['sadness',4,/\b(i ?m|im|i am|feeling) (so |really |very )?(sad|upset|down|lonely)\b/],
 ['frustration',4,/\b(i ?m|im|i am|feeling) (so |really |very )?(frustrated|annoyed|irritated)\b/],
 ['celebration',4,/\b(i ?m|im|i am|we ?re|we are) (so |really |super )?(happy|excited|thrilled)\b/],
 ['celebration',3,/\b(yay+|woohoo+|hooray|yippee)\b/],
 ['love',4,/\b(love you|love you guys|youre the best|you are the best)\b/],
 ['gratitude',4,/\b(thank you so much|thanks so much|so grateful|really appreciate (you|it))\b/],
 ['laughter',4,/\b(i ?m|im|i am) (laughing so hard|cracking up)|\bthats hilarious\b/],
 ['surprise',4,/\b(i ?m|im|i am) (so |really )?(surprised|amazed|astonished)|\bwhat a surprise\b/],
 ['relief',4,/\b(i ?m|im|i am) (so |really )?relieved|\bwhat a relief\b/],
 ['laughter',2,/\b(lol+|lmao|haha(?:ha)*)\b|😂|🤣/],
 ['surprise',2,/\b(wow+|omg)\b|😮|🤯/],
 ['relief',2,/\b(phew+|finally)\b/],
 ['gratitude',2,/\b(thanks|thank you)\b/],
 ['love',2,/❤️|🫶/],
 ['celebration',1,/\b(awesome|amazing|nice|great)\b|🎉|🥳/]
 ];
 if(clearWin&&!negative.test(t)&&4+boost>=threshold)return 'celebration';
 for(const [emotion,score,pattern]of rules){const quiet=emotion==='sadness'||emotion==='frustration';if(pattern.test(t)&&score+boost>=threshold&&(quiet||!badContext&&!negative.test(t)))return emotion}return null;
}

let overlay,timer,last=0;const seen=new Set();
export function stop(){clearTimeout(timer);overlay?.remove();overlay=null}
export function receive(items,{ownerId,context=[],chat,sensitivity=3}={}){if(typeof document==='undefined'||document.visibilityState!=='visible'||!window.DockGroupMeChat?.isVisible()||document.documentElement.dataset.groupmeMotion==='quick'||matchMedia('(prefers-reduced-motion:reduce)').matches)return;let emotion;for(const m of items.slice(-5)){const key=chat+':'+m.id;if(seen.has(key))continue;seen.add(key);if(seen.size>500)seen.delete(seen.values().next().value);if(String(m.user_id||m.sender_id)===String(ownerId)||m.system||m.sender_type==='system'||m.attachments?.some(a=>a.type==='reply')||!Number.isFinite(m.created_at)||Math.abs(Date.now()-m.created_at*1000)>90000)continue;emotion=contextEmotion(m.text,context,sensitivity)||emotion}if(!emotion||Date.now()-last<10000)return;last=Date.now();stop();overlay=document.createElement('div');overlay.className='context-effect context-'+emotion;overlay.setAttribute('aria-hidden','true');overlay.inert=true;const colors=['#f4cc53','#9ed9cb','#b6aff5','#f4a8bd'];for(let i=0;i<(emotion==='celebration'?36:12);i++){const bit=document.createElement('i');const side=i%2;bit.style.cssText=`--side:${side?'100%':'0%'};--dx:${(side?-1:1)*(innerWidth*(.24+Math.random()*.26))}px;--dy:${-150+Math.random()*300}px;--turn:${Math.random()*720}deg;--delay:${Math.random()*180}ms;--color:${colors[i%4]};top:${35+Math.random()*35}%`;overlay.append(bit)}document.body.append(overlay);timer=setTimeout(stop,1600)}
if(typeof window!=='undefined'){window.DockGroupMeContextReactions={receive,stop};document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')stop()});window.addEventListener('pagehide',stop)}
