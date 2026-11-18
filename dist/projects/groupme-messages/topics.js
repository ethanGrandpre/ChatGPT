const $=id=>document.getElementById(id),chat=()=>window.DockGroupMeChat;
let parent=null,items=[],canManage=false,hasMore=false,page=1,version=0,loading=false,writing=false,timer;
const uncertain=new Set();
function status(text,error=false){$('topics-status').textContent=text;$('topics-status').hidden=!text;$('topics-status').dataset.error=String(error)}
async function api(action,data){let response;try{response=await fetch('/api/groupme/'+action,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(25000),...(data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})})}catch{const error=Error(data?'The request could not be confirmed. Refresh topics before trying again.':'Could not load topics. Check your connection and retry.');error.uncertain=!!data;throw error}let result;try{result=await response.json()}catch{const error=Error('Dock returned an unreadable topic response. Sign in again, then refresh topics.');error.uncertain=!!data;throw error}if(!response.ok){const error=Error(result.error||'GroupMe could not complete the topic request.');error.uncertain=['TOPIC_CREATE_UNCONFIRMED','TOPIC_WRITE_UNCONFIRMED'].includes(result.code);throw error}return result.response}
function currentParent(){if(chat()?.getCurrent()?.kind!=='groups')return null;return chat().getParentGroup()}
function render(){
 const selected=chat()?.getCurrent();$('topic-bar').hidden=!parent;
 if(!parent)return;
 const root=$('topic-tabs');root.replaceChildren();
 function tab(label,id,handler){const button=document.createElement('button');button.type='button';button.textContent=label;button.title=label;button.setAttribute('aria-pressed',String(selected?.id===id));button.onclick=handler;root.append(button)}
 tab('#main',String(parent.id),()=>chat().openChannel(parent));
 for(const item of items)tab('#'+item.topic.replace(/^#+/,''),item.id,()=>open(item));
 if(hasMore){const more=document.createElement('button');more.textContent='More topics';more.disabled=loading;more.onclick=()=>load(true);root.append(more)}
 $('topics-refresh').disabled=loading||writing;$('topic-create-open').hidden=!canManage;$('topic-create-open').disabled=loading||writing;
 $('topic-delete-open').hidden=!canManage||selected?.id===String(parent.id)||!items.some(item=>item.id===selected?.id);$('topic-delete-open').disabled=loading||writing;
 chat()?.layoutChanged();
}
function open(item){if(writing)return;chat().openChannel({...item,name:parent.name+' · #'+item.topic,parent_id:String(parent.id),parent_group:parent})}
async function load(more=false){
 if(!parent||loading||writing)return;const id=String(parent.id),generation=version;loading=true;render();
 try{const result=await api('topics?group='+encodeURIComponent(id)+'&page='+(more?page+1:1));if(version!==generation)return;
  if(!Array.isArray(result?.topics))throw Error('GroupMe returned an unexpected topic list.');
  parent={...parent,...result.group};items=more?[...new Map([...items,...result.topics].map(item=>[item.id,item])).values()]:result.topics;canManage=result.can_manage===true;hasMore=result.has_more===true;page=more?page+1:1;uncertain.delete(id);status('');
  const selected=chat().getCurrent(),item=items.find(item=>item.id===selected?.id);if(item)chat().updateChannel({id:item.id,can_post:item.can_post});else if(selected?.parentId===id&&!hasMore&&!more){chat().openChannel(parent);status('That topic is no longer available. Showing #main.')}
 }catch(error){if(version===generation)status(error.message,true)}finally{if(version===generation){loading=false;render()}}
}
function changed(){
 const next=currentParent();if(!next){version++;parent=null;loading=false;items=[];clearTimeout(timer);$('topic-bar').hidden=true;status('');return}
 if(String(next.id)===String(parent?.id)){render();return}
 version++;parent=next;items=[];page=1;canManage=false;hasMore=false;loading=false;status('Loading topics…');render();load();schedule();
}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>{if(document.visibilityState==='visible')load();schedule()},60000)}
$('topics-refresh').onclick=()=>load();
$('topic-create-open').onclick=()=>{if(!parent||!canManage||writing)return;$('topic-name').value='';$('topic-posting').value='private';$('topic-create-status').textContent=uncertain.has(String(parent.id))?'Refresh topics before trying another request.':'';$('topic-create-submit').disabled=uncertain.has(String(parent.id));$('topic-create-dialog').showModal();$('topic-name').focus()};
$('topic-create-close').onclick=()=>{if(!writing)$('topic-create-dialog').close()};
$('topic-create-dialog').addEventListener('cancel',event=>{if(writing)event.preventDefault()});
$('topic-create-form').onsubmit=async event=>{
 event.preventDefault();if(!parent||!canManage||writing||uncertain.has(String(parent.id)))return;const group=String(parent.id),name=$('topic-name').value.trim(),type=$('topic-posting').value;if(!name||name.length>80)return;
 writing=true;for(const id of ['topic-name','topic-posting','topic-create-submit','topic-create-close'])$(id).disabled=true;$('topic-create-status').textContent='Creating topic…';render();
 try{const result=await api('topic-create',{group,name,type});if(!result?.topic?.id)throw Object.assign(Error('Creation could not be confirmed. Refresh topics before trying again.'),{uncertain:true});if(String(parent?.id)!==group)return;items=[...items,result.topic];$('topic-create-dialog').close();openCreated(result.topic);status('Created #'+result.topic.topic+'.')}
 catch(error){if(error.uncertain)uncertain.add(group);$('topic-create-status').textContent=error.message}
 finally{writing=false;for(const id of ['topic-name','topic-posting','topic-create-close'])$(id).disabled=false;$('topic-create-submit').disabled=uncertain.has(group);render()}
};
function openCreated(item){chat().openChannel({...item,name:parent.name+' · #'+item.topic,parent_id:String(parent.id),parent_group:parent})}
$('topic-delete-open').onclick=()=>{if(!parent||!canManage||writing)return;const item=items.find(item=>item.id===chat().getCurrent()?.id);if(!item)return;$('topic-delete-name').textContent='#'+item.topic;$('topic-delete-status').textContent='';$('topic-delete-confirm').disabled=uncertain.has(String(parent.id));$('topic-delete-dialog').showModal();$('topic-delete-cancel').focus()};
$('topic-delete-cancel').onclick=()=>{if(!writing)$('topic-delete-dialog').close()};$('topic-delete-dialog').addEventListener('cancel',event=>{if(writing)event.preventDefault()});
$('topic-delete-confirm').onclick=async()=>{
 const item=items.find(item=>item.id===chat()?.getCurrent()?.id);if(!parent||!canManage||!item||writing||uncertain.has(String(parent.id)))return;const group=String(parent.id),id=item.id;writing=true;$('topic-delete-confirm').disabled=true;$('topic-delete-cancel').disabled=true;$('topic-delete-status').textContent='Deleting topic…';render();
 try{await api('topic-delete',{group,topic:id});if(String(parent?.id)!==group)return;items=items.filter(item=>item.id!==id);$('topic-delete-dialog').close();chat().openChannel(parent);status('Deleted #'+item.topic+'.')}
 catch(error){if(error.uncertain)uncertain.add(group);$('topic-delete-status').textContent=error.message}
 finally{writing=false;$('topic-delete-cancel').disabled=false;$('topic-delete-confirm').disabled=uncertain.has(group);render()}
};
for(const id of ['topic-create-dialog','topic-delete-dialog'])$(id).addEventListener('close',()=>{const target=$('topic-tabs').querySelector('[aria-pressed=true]');target?.focus({preventScroll:true})});
window.DockGroupMeTopics={chatChanged:changed};document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&parent)load()});window.addEventListener('pagehide',()=>clearTimeout(timer));window.addEventListener('pageshow',()=>{if(parent)schedule()});changed();
