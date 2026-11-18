const $=id=>document.getElementById(id),chat=()=>window.DockGroupMeChat;
let parent=null,items=[],canManage=false,hasMore=false,page=1,loading=false,writing=false,timer,revision=0;
const uncertain=new Set(),states=new Map(),expanded=new Set();
function currentParent(){if(chat()?.getCurrent()?.kind!=='groups')return null;return chat().getParentGroup()}
function stateFor(group){const id=String(group.id);if(!states.has(id))states.set(id,{group,items:[],canManage:false,hasMore:false,page:1,loading:false,loadedAt:0,status:'',error:false,nav:null,signature:''});const state=states.get(id);state.group={...state.group,...group};return state}
function selectedState(){const group=currentParent();return group?stateFor(group):null}
function notifySidebar(){revision++;chat()?.renderSidebar()}
function status(text,error=false){$('topics-status').textContent=text;$('topics-status').hidden=!text;$('topics-status').dataset.error=String(error);if(parent){const state=states.get(String(parent.id));if(state){state.status=text;state.error=error}}}
async function api(action,data){let response;try{response=await fetch('/api/groupme/'+action,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(25000),...(data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})})}catch{const error=Error(data?'The request could not be confirmed. Refresh topics before trying again.':'Could not load topics. Check your connection and retry.');error.uncertain=!!data;throw error}let result;try{result=await response.json()}catch{const error=Error('Dock returned an unreadable topic response. Sign in again, then refresh topics.');error.uncertain=!!data;throw error}if(!response.ok){const error=Error(result.error||'GroupMe could not complete the topic request.');error.uncertain=['TOPIC_CREATE_UNCONFIRMED','TOPIC_WRITE_UNCONFIRMED'].includes(result.code);throw error}return result.response}
function adopt(state){parent=state.group;items=state.items;canManage=state.canManage;hasMore=state.hasMore;page=state.page;loading=state.loading;status(state.status,state.error)}
function storeCurrent(){if(!parent)return;const state=stateFor(parent);Object.assign(state,{items,canManage,hasMore,page,loading,loadedAt:Date.now()});notifySidebar()}
function render(){
 const state=selectedState(),selected=chat()?.getCurrent();$('topic-bar').hidden=!state;
 if(!state)return;adopt(state);
 const item=items.find(item=>item.id===selected?.id);$('topic-tabs').textContent=item?'#'+item.topic.replace(/^#+/,''):'#main';
 $('topics-refresh').disabled=loading||writing;$('topic-create-open').hidden=!canManage;$('topic-create-open').disabled=loading||writing;
 $('topic-delete-open').hidden=!canManage||selected?.id===String(parent.id)||!item;$('topic-delete-open').disabled=loading||writing;
 chat()?.layoutChanged();
}
function open(item,group=parent){if(writing||!group)return;chat().openChannel({...item,name:group.name+' · #'+item.topic.replace(/^#+/,''),parent_id:String(group.id),parent_group:group})}
async function loadState(state,more=false){
 if(state.loading||writing)return;state.loading=true;state.status=state.loadedAt?'':'Loading topics…';state.error=false;notifySidebar();render();
 try{const result=await api('topics?group='+encodeURIComponent(state.group.id)+'&page='+(more?state.page+1:1));if(!Array.isArray(result?.topics))throw Error('GroupMe returned an unexpected topic list.');
  state.group={...state.group,...result.group};state.items=more?[...new Map([...state.items,...result.topics].map(item=>[item.id,item])).values()]:result.topics;state.canManage=result.can_manage===true;state.hasMore=result.has_more===true;state.page=more?state.page+1:1;state.loadedAt=Date.now();state.status='';state.error=false;uncertain.delete(String(state.group.id));
  const selected=chat().getCurrent();if(String(currentParent()?.id)===String(state.group.id)){const item=state.items.find(item=>item.id===selected?.id);if(item)chat().updateChannel({id:item.id,can_post:item.can_post});else if(selected?.parentId===String(state.group.id)&&!state.hasMore&&!more){chat().openChannel(state.group);state.status='That topic is no longer available. Showing #main.'}}
 }catch(error){state.status=error.message;state.error=true}finally{state.loading=false;notifySidebar();render()}
}
function load(more=false){const state=selectedState();if(state)return loadState(state,more)}
function changed(){const state=selectedState();if(!state){parent=null;items=[];canManage=false;clearTimeout(timer);$('topic-bar').hidden=true;status('');notifySidebar();return}expanded.add(String(state.group.id));adopt(state);render();notifySidebar();if(Date.now()-state.loadedAt>60000)loadState(state);schedule()}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>{if(document.visibilityState==='visible')load();schedule()},60000)}
function sidebarFor(group){
 const id=String(group.id);if(!expanded.has(id))return null;const state=stateFor(group),selected=chat()?.getCurrent(),signature=JSON.stringify([state.items,state.loading,state.status,state.error,state.hasMore,selected?.kind,selected?.id,writing]);
 if(!state.nav){state.nav=document.createElement('nav');state.nav.className='sidebar-topics';state.nav.id='topics-for-'+id;state.nav.setAttribute('aria-label',group.name+' topics')}
 if(state.signature===signature)return state.nav;state.signature=signature;const focused=state.nav.contains(document.activeElement)?document.activeElement.dataset.channelId:null;state.nav.replaceChildren();
 function add(label,target,handler){const button=document.createElement('button');button.type='button';button.textContent=label;button.title=label;button.dataset.channelId=target;button.setAttribute('aria-pressed',String(selected?.kind==='groups'&&selected.id===target));button.disabled=writing;button.onclick=handler;state.nav.append(button)}
 add('#main',id,()=>chat().openChannel(state.group));for(const item of state.items)add('#'+item.topic.replace(/^#+/,''),item.id,()=>open(item,state.group));
 if(state.status&&(state.error||!state.loadedAt)){const note=document.createElement('p');note.textContent=state.status;note.className='sidebar-topics-status';state.nav.append(note)}
 if(state.error){const retry=document.createElement('button');retry.textContent='Retry topics';retry.onclick=()=>loadState(state);state.nav.append(retry)}
 if(state.hasMore){const more=document.createElement('button');more.textContent='More topics';more.disabled=state.loading;more.onclick=()=>loadState(state,true);state.nav.append(more)}if(focused){const target=Array.from(state.nav.children).find(node=>node.dataset.channelId===focused);if(target?.getClientRects().length)target.focus({preventScroll:true})}return state.nav;
}
function toggleGroup(group){if(writing)return;const id=String(group.id),state=stateFor(group);if(expanded.has(id))expanded.delete(id);else{expanded.add(id);if(Date.now()-state.loadedAt>60000)loadState(state)}notifySidebar()}
$('topic-tabs').onclick=()=>chat()?.showConversations();
$('topics-refresh').onclick=()=>load();
$('topic-create-open').onclick=()=>{if(!parent||!canManage||writing)return;$('topic-name').value='';$('topic-posting').value='private';$('topic-create-status').textContent=uncertain.has(String(parent.id))?'Refresh topics before trying another request.':'';$('topic-create-submit').disabled=uncertain.has(String(parent.id));$('topic-create-dialog').showModal();$('topic-name').focus()};
$('topic-create-close').onclick=()=>{if(!writing)$('topic-create-dialog').close()};
$('topic-create-dialog').addEventListener('cancel',event=>{if(writing)event.preventDefault()});
$('topic-create-form').onsubmit=async event=>{
 event.preventDefault();if(!parent||!canManage||writing||uncertain.has(String(parent.id)))return;const group=String(parent.id),name=$('topic-name').value.trim(),type=$('topic-posting').value;if(!name||name.length>80)return;
 writing=true;for(const id of ['topic-name','topic-posting','topic-create-submit','topic-create-close'])$(id).disabled=true;$('topic-create-status').textContent='Creating topic…';render();
 try{const result=await api('topic-create',{group,name,type});if(!result?.topic?.id)throw Object.assign(Error('Creation could not be confirmed. Refresh topics before trying again.'),{uncertain:true});if(String(parent?.id)!==group)return;items=[...items,result.topic];storeCurrent();$('topic-create-dialog').close();openCreated(result.topic);status('Created #'+result.topic.topic+'.')}
 catch(error){if(error.uncertain)uncertain.add(group);$('topic-create-status').textContent=error.message}
 finally{writing=false;for(const id of ['topic-name','topic-posting','topic-create-close'])$(id).disabled=false;$('topic-create-submit').disabled=uncertain.has(group);render();notifySidebar()}
};
function openCreated(item){chat().openChannel({...item,name:parent.name+' · #'+item.topic.replace(/^#+/,''),parent_id:String(parent.id),parent_group:parent})}
$('topic-delete-open').onclick=()=>{if(!parent||!canManage||writing)return;const item=items.find(item=>item.id===chat().getCurrent()?.id);if(!item)return;$('topic-delete-name').textContent='#'+item.topic;$('topic-delete-status').textContent='';$('topic-delete-confirm').disabled=uncertain.has(String(parent.id));$('topic-delete-dialog').showModal();$('topic-delete-cancel').focus()};
$('topic-delete-cancel').onclick=()=>{if(!writing)$('topic-delete-dialog').close()};$('topic-delete-dialog').addEventListener('cancel',event=>{if(writing)event.preventDefault()});
$('topic-delete-confirm').onclick=async()=>{
 const item=items.find(item=>item.id===chat()?.getCurrent()?.id);if(!parent||!canManage||!item||writing||uncertain.has(String(parent.id)))return;const group=String(parent.id),id=item.id;writing=true;$('topic-delete-confirm').disabled=true;$('topic-delete-cancel').disabled=true;$('topic-delete-status').textContent='Deleting topic…';render();
 try{await api('topic-delete',{group,topic:id});if(String(parent?.id)!==group)return;items=items.filter(item=>item.id!==id);storeCurrent();$('topic-delete-dialog').close();chat().openChannel(parent);status('Deleted #'+item.topic+'.')}
 catch(error){if(error.uncertain)uncertain.add(group);$('topic-delete-status').textContent=error.message}
 finally{writing=false;$('topic-delete-cancel').disabled=false;$('topic-delete-confirm').disabled=uncertain.has(group);render();notifySidebar()}
};
for(const id of ['topic-create-dialog','topic-delete-dialog'])$(id).addEventListener('close',()=>{$('topic-tabs').focus({preventScroll:true})});
window.DockGroupMeTopics={chatChanged:changed,sidebarFor,toggleGroup,isExpanded:id=>expanded.has(String(id)),revision:()=>revision,focusCurrent:()=>{const state=selectedState();if(state){expanded.add(String(state.group.id));notifySidebar();const target=state.nav?.querySelector('[aria-pressed=true]');target?.focus({preventScroll:true})}}};document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&parent)load()});window.addEventListener('pagehide',()=>clearTimeout(timer));window.addEventListener('pageshow',()=>{if(parent)schedule()});changed();
