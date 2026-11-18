export function sharedLinks(messages,query=''){
 const found=new Map(),q=query.trim().toLocaleLowerCase();
 for(const message of [...messages].sort((a,b)=>b.created_at-a.created_at))for(const match of String(message.text||'').matchAll(/https?:\/\/[^\s<>]+/gi)){
  const raw=match[0].replace(/[.,!?;:)}\]]+$/,'');let url;try{url=new URL(raw)}catch{continue}if(!['https:','http:'].includes(url.protocol)||url.username||url.password||found.has(url.href))continue;
  const item={url:url.href,host:url.hostname,name:String(message.name||'Member'),at:message.created_at};if(!q||(item.url+' '+item.name).toLocaleLowerCase().includes(q))found.set(url.href,item);
 }return [...found.values()];
}
