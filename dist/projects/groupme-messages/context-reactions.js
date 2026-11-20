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
 ['anger',4,/\b(i ?m|im|i am|feeling) (so |really |very )?(angry|furious|mad|livid)\b/],
 ['anxiety',4,/\b(i ?m|im|i am|feeling) (so |really |very )?(anxious|nervous|worried|stressed)\b/],
 ['fear',4,/\b(i ?m|im|i am|feeling) (so |really |very )?(scared|afraid|terrified|frightened)\b/],
 ['embarrassment',4,/\b(i ?m|im|i am|feeling) (so |really |very )?(embarrassed|mortified|awkward)\b/],
 ['disappointment',4,/\b(i ?m|im|i am|feeling) (so |really |very )?(disappointed|let down)\b/],
 ['fatigue',4,/\b(i ?m|im|i am|feeling) (so |really |very )?(tired|exhausted|sleepy|drained)\b/],
 ['boredom',4,/\b(i ?m|im|i am|feeling) (so |really |very )?bored\b/],
 ['confusion',4,/\b(i ?m|im|i am|feeling) (so |really |very )?(confused|puzzled|unsure)\b/],
 ['pride',4,/\b(i ?m|im|i am|we are) (so |really |very )?proud\b/],
 ['confidence',4,/\b(i ?m|im|i am|feeling) (so |really |very )?confident\b|\bive got this\b/],
 ['hope',4,/\b(i ?m|im|i am|feeling) (so |really |very )?(hopeful|optimistic)\b/],
 ['curiosity',4,/\b(i ?m|im|i am|feeling) (so |really |very )?(curious|intrigued)\b/],
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
 for(const [emotion,score,pattern]of rules){const quiet=['sadness','frustration','anger','anxiety','fear','embarrassment','disappointment','fatigue','boredom','confusion'].includes(emotion);if(pattern.test(t)&&score+boost>=threshold&&(quiet||!badContext&&!negative.test(t)))return emotion}return null;
}

export const EMOTIONS={celebration:['Celebration','🎉 🥳 ✨'],love:['Affection','❤️ 🫶 💖'],gratitude:['Gratitude','🙏 💛 ✨'],laughter:['Laughter','😂 🤣 😆'],surprise:['Surprise','😮 🤯 ✨'],relief:['Relief','😌 🍃 💚'],sadness:['Sadness','💙 🥺 💧'],frustration:['Frustration','😤 💨 🌀'],anger:['Anger','😠 💢 😤'],anxiety:['Anxiety','😰 🫧 💜'],fear:['Fear','😨 😧 💜'],embarrassment:['Embarrassment','😳 🙈 🫣'],disappointment:['Disappointment','😞 💙 🫧'],fatigue:['Fatigue','😴 💤 🌙'],boredom:['Boredom','🥱 🫠 🫧'],confusion:['Confusion','😕 ❔ 🌀'],pride:['Pride','🏆 🌟 💪'],confidence:['Confidence','😎 💪 ⭐'],hope:['Hope','🌈 🌱 ✨'],curiosity:['Curiosity','🧐 🔎 💡']};
const EMOJI_KEY='dock-groupme-emotion-emojis-v1';
const emojiAtom=String.raw`(?:[\p{Regional_Indicator}]{2}|[0-9#*]\uFE0F?\u20E3|(?!(?:\p{Emoji_Modifier}|\p{Regional_Indicator}))[\p{Extended_Pictographic}\p{Emoji_Presentation}]\uFE0F?\p{Emoji_Modifier}?)`;
const emojiPattern=new RegExp('^'+emojiAtom+'(?:\\u200D'+emojiAtom+')*$','u');
export function parseEmojiChoices(value){if(typeof value!=='string'||value.length>96)return null;const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter(undefined,{granularity:'grapheme'}):null;const items=segmenter?[...segmenter.segment(value)].map(x=>x.segment).filter(x=>x.trim()):value.trim().split(/\s+/).filter(Boolean);return items.length<=4&&items.every(x=>emojiPattern.test(x))?items:null}
let choices={};
function readChoices(){try{const data=JSON.parse(localStorage.getItem(EMOJI_KEY)||'{}');choices=Object.fromEntries(Object.keys(EMOTIONS).filter(k=>typeof data?.[k]==='string'&&parseEmojiChoices(data[k])!==null).map(k=>[k,data[k]]))}catch{choices={}}}
function emojiChoices(emotion){return parseEmojiChoices(choices[emotion]??EMOTIONS[emotion]?.[1]??'')||[]}
function setupChoices(){readChoices();const root=document.getElementById('context-emoji-settings');if(!root)return;for(const [key,[label,defaults]]of Object.entries(EMOTIONS)){const row=document.createElement('label');row.className='context-emoji-row';const name=document.createElement('span');name.textContent=label;const input=document.createElement('input');input.type='text';input.maxLength=96;input.id='context-emoji-'+key;input.setAttribute('aria-label',label+' reaction emojis');input.value=choices[key]??defaults;input.placeholder=defaults;input.onchange=()=>{const parsed=parseEmojiChoices(input.value),status=document.getElementById('context-emoji-status');if(parsed===null){input.setAttribute('aria-invalid','true');status.textContent='Use up to four emojis, without words. Leave blank to disable this emotion.';return}const next={...choices,[key]:parsed.join(' ')};try{localStorage.setItem(EMOJI_KEY,JSON.stringify(next));choices=next;input.setAttribute('aria-invalid','false');status.textContent='Emoji choices saved.'}catch{status.textContent='Could not save emoji choices. Try again.'}};row.append(name,input);root.append(row)}document.getElementById('context-emoji-reset').onclick=()=>{try{localStorage.setItem(EMOJI_KEY,'{}');choices={};for(const [key,[,defaults]]of Object.entries(EMOTIONS)){const input=document.getElementById('context-emoji-'+key);input.value=defaults;input.removeAttribute('aria-invalid')}document.getElementById('context-emoji-status').textContent='Default emojis restored.'}catch{document.getElementById('context-emoji-status').textContent='Could not restore defaults.'}};window.addEventListener('storage',event=>{if(event.key!==EMOJI_KEY&&event.key!==null)return;readChoices();for(const [key,[,defaults]]of Object.entries(EMOTIONS)){const input=document.getElementById('context-emoji-'+key);if(document.activeElement!==input)input.value=choices[key]??defaults}})}

let overlay,timer,last=0;const seen=new Set();
export function stop(){clearTimeout(timer);overlay?.remove();overlay=null}
export function receive(items,{ownerId,context=[],chat,sensitivity=3}={}){if(typeof document==='undefined'||document.visibilityState!=='visible'||!window.DockGroupMeChat?.isVisible()||document.documentElement.dataset.groupmeMotion==='quick'||matchMedia('(prefers-reduced-motion:reduce)').matches)return;let emotion;for(const m of items.slice(-5)){const key=chat+':'+m.id;if(seen.has(key))continue;seen.add(key);if(seen.size>500)seen.delete(seen.values().next().value);if(String(m.user_id||m.sender_id)===String(ownerId)||m.system||m.sender_type==='system'||m.attachments?.some(a=>a.type==='reply')||!Number.isFinite(m.created_at)||Math.abs(Date.now()-m.created_at*1000)>90000)continue;emotion=contextEmotion(m.text,context,sensitivity)||emotion}if(!emotion||Date.now()-last<10000)return;const emojis=emojiChoices(emotion);if(!emojis.length)return;last=Date.now();stop();overlay=document.createElement('div');overlay.className='context-effect context-'+emotion;overlay.setAttribute('aria-hidden','true');overlay.inert=true;for(let i=0;i<(emotion==='celebration'?36:12);i++){const bit=document.createElement('i');const side=i%2;bit.className='context-emoji';bit.textContent=emojis[i%emojis.length];bit.style.cssText=`--side:${side?'100%':'0%'};--dx:${(side?-1:1)*(innerWidth*(.24+Math.random()*.26))}px;--dy:${-150+Math.random()*300}px;--turn:${Math.random()*720}deg;--delay:${Math.random()*180}ms;--emoji-size:${28+Math.random()*32}px;top:${35+Math.random()*35}%`;overlay.append(bit)}document.body.append(overlay);timer=setTimeout(stop,1600)}
if(typeof window!=='undefined'){window.DockGroupMeContextReactions={receive,stop};setupChoices();document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')stop()});window.addEventListener('pagehide',stop)}
