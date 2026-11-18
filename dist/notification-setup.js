import {SETUP_VERSION,PROJECTS,reconnectProject,pushRequest,restoreTaskSchedule} from './notification-client.js';
const KEY='__dock_notification_setup',DISMISSED=KEY+'_dismissed';
await window.DockProjectSync?.ready;
const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('notification-setup.css',import.meta.url).href;document.head.append(css);
const dialog=document.createElement('dialog');dialog.id='notification-setup';dialog.setAttribute('aria-labelledby','notification-setup-title');
dialog.innerHTML='<div class="notification-setup-head"><h2 id="notification-setup-title">Set up notifications</h2><button type="button" id="notification-setup-close" aria-label="Close notification setup">×</button></div><p>Notification setup has been updated. Reconnect this device so alerts can arrive with Dock closed.</p><fieldset><legend>Choose alerts for this device</legend><label><input type="checkbox" value="groupme" checked> GroupMe</label><label><input type="checkbox" value="tasks" checked> Tasks</label></fieldset><p class="notification-setup-help">Enable asks for browser permission, rebuilds these push connections, and sends test alerts 10 seconds later. Watched chats and saved tasks stay intact.</p><ol id="notification-setup-steps"><li>Allow notifications</li><li>Reconnect selected projects</li><li>Schedule closed-tab test alerts</li></ol><p id="notification-setup-status" role="status"></p><div class="notification-setup-actions"><button type="button" id="notification-setup-enable">Enable and send tests</button><button type="button" id="notification-setup-later">Later</button></div><p class="notification-setup-help">GroupMe: turn Notify on for each desired chat or topic. Tasks: set a reminder time. Battery settings and Do Not Disturb can delay alerts.</p>';
document.body.append(dialog);
const $=id=>document.getElementById(id);let busy=false,completed=false,previousFocus;
function dismiss(){if(busy)return;try{sessionStorage.setItem(DISMISSED,SETUP_VERSION)}catch{}dialog.close()}
function show(){previousFocus=document.activeElement;if(!dialog.open)dialog.showModal();$('notification-setup-enable').focus()}
$('notification-setup-close').onclick=dismiss;$('notification-setup-later').onclick=dismiss;dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss()});dialog.addEventListener('close',()=>{if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true})});
function status(text){$('notification-setup-status').textContent=text}
function stage(index){[...$('notification-setup-steps').children].forEach((node,i)=>node.dataset.state=i<index?'done':i===index?'active':'waiting')}
$('notification-setup-enable').onclick=async()=>{
 if(busy)return;if(completed){dismiss();return}const selected=[...dialog.querySelectorAll('input:checked')].map(input=>input.value);if(!selected.length){status('Choose at least one project, or choose Later.');return}
 busy=true;dialog.querySelectorAll('button,input').forEach(node=>node.disabled=true);stage(0);
 try{
  if(!window.isSecureContext||!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw Error('Web Push is unavailable here. Use Android Chrome or a supported desktop browser. On iPhone/iPad, add Dock to the Home Screen first.');
  // Request before any network await: browsers require the user's tap.
  const permission=await Notification.requestPermission();if(permission!=='granted')throw Error(permission==='denied'?'Notifications are blocked for this site. Open address-bar site permissions, set Notifications to Allow, then retry. Also allow browser notifications in phone Settings.':'Permission was not granted. Press Enable again when ready.');
  stage(1);const connected=[];
  for(const kind of selected){status('Reconnecting '+PROJECTS[kind].name+'…');const connection=await reconnectProject(kind);if(kind==='tasks'){const count=await restoreTaskSchedule(connection);connection.reminderCount=count;status('Tasks connected · '+count+' reminders scheduled.')}connected.push(connection)}
  stage(2);for(const connection of connected){const result=await pushRequest(connection.project,connection.deviceId,{action:'test-delayed'});if(!result.scheduled)throw Error('The server did not confirm the delayed test. Retry setup.')}
  try{localStorage.setItem(KEY,JSON.stringify({version:SETUP_VERSION,projects:selected,at:Date.now()}))}catch{}
  window.dispatchEvent(new CustomEvent('dock-notifications-connected',{detail:{projects:selected}}));completed=true;stage(3);status('Connected. Test alerts are scheduled for about 10 seconds from now—you can close Dock. Delivery may take longer.\n'+connected.map(c=>c.kind==='groupme'?'GroupMe: '+(c.config.chats||[]).length+' watched chats restored. Turn Notify on in each desired chat or topic.':'Tasks: '+c.reminderCount+' reminders scheduled.').join('\n'));const links=document.createElement('div');links.className='notification-setup-actions';for(const kind of selected){const link=document.createElement('a');link.href=new URL('projects/'+PROJECTS[kind].folder+'/run.html',import.meta.url).href;link.textContent=kind==='groupme'?'Choose GroupMe chats':'Open Tasks';links.append(link)}dialog.append(links);$('notification-setup-enable').textContent='Done';$('notification-setup-later').hidden=true;
 }catch(error){status(error.message||'Setup failed. Reload and retry.');$('notification-setup-enable').textContent='Retry setup'}finally{busy=false;dialog.querySelectorAll('button,input').forEach(node=>node.disabled=false)}
};
window.DockNotificationSetup={open:show};window.addEventListener('dock-open-notification-setup',show);
const open=document.createElement('button');open.type='button';open.id='notification-setup-open';open.textContent='Notification setup';open.onclick=show;
const target=document.querySelector('.header-actions')||document.querySelector('.header-settings')||document.querySelector('#notification-status')?.parentElement;if(target)target.append(open);
let showInitial=true;try{showInitial=JSON.parse(localStorage.getItem(KEY)||'null')?.version!==SETUP_VERSION&&sessionStorage.getItem(DISMISSED)!==SETUP_VERSION}catch{}
if(showInitial){const alreadyOpen=document.querySelector('dialog[open]');if(alreadyOpen)alreadyOpen.addEventListener('close',show,{once:true});else show()}
