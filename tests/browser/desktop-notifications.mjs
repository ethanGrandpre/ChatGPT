import http from 'node:http';
import path from 'node:path';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.DOCK_PLAYWRIGHT_MODULE||'playwright');
await mkdir('work',{recursive:true});
const server=http.createServer(async(req,res)=>{try{const relative=new URL(req.url,'http://local').pathname.slice(1),file=path.resolve(relative.startsWith('projects/')?relative:'src/'+relative);if(!file.startsWith(process.cwd()+'/'))throw Error();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file))}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:process.env.DOCK_TEST_NO_SANDBOX==='1'?['--no-sandbox']:[]});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[],reactions=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('__dock_notification_setup',JSON.stringify({version:'notifications-2026-11-v4-desktop'})));
 const history=[{id:'1',user_id:'2',name:'Alex',text:'An incoming message',created_at:1700000000,favorited_by:['3','4']},{id:'2',user_id:'1',name:'Owner',text:'My outgoing message',created_at:1700000002,favorited_by:['2']}];
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();if(url.pathname==='/projects.json')return route.fulfill({json:[]});if(!url.pathname.startsWith('/api/'))return route.continue();let response={};if(url.pathname.includes('project-sync'))response={entries:{},revision:1};else if(url.pathname.includes('groupme-push'))response={chats:[],publicKey:'AQ'};else{let data=[];if(url.pathname.endsWith('/status'))data={id:'1',name:'Owner'};else if(url.pathname.endsWith('/groups'))data=[{id:'123',name:'Family',messages:{count:history.length,last_message_id:history.at(-1).id}}];else if(url.pathname.endsWith('/topics'))data={group:{id:'123',name:'Family'},topics:[],can_manage:false};else if(url.pathname.endsWith('/messages'))data={messages:history};else if(url.pathname.endsWith('/react')){const input=route.request().postDataJSON();reactions.push(input);const message=history.find(m=>m.id===input.message);message.favorited_by=[...new Set([...message.favorited_by,'1'])];message.dock_reaction=input.emoji;data={confirmed:true,message_id:input.message,emoji:input.emoji,favorited_by:message.favorited_by}}response={release:'groupme-notify-emoji-1',response:data}}await route.fulfill({json:response})});

 await page.goto('http://127.0.0.1:'+server.address().port+'/projects/desktop/run.html');await page.locator('#pc-icons [data-project-id="dock"]').click();await page.evaluate(()=>document.querySelector('.app-window iframe').src='/projects/groupme-messages/run.html');
 const frame=await page.waitForFunction(()=>{const f=document.querySelector('.app-window iframe');return f?.contentWindow?.location.pathname.includes('groupme-messages')});
 const chat=page.frameLocator('.app-window iframe');await chat.getByRole('button',{name:'Family',exact:true}).click();await chat.locator('#topics-for-123').getByRole('button',{name:'#main',exact:true}).click();await chat.locator('.message').last().waitFor();
 const appFrame=page.frames().find(f=>f.url().includes('groupme-messages/run.html'));
 await page.waitForFunction(()=>document.querySelector('.app-window').dataset.groupme==='true');
 const win=page.locator('.app-window');await win.getByRole('button',{name:'Minimize',exact:true}).click();await appFrame.waitForFunction(()=>!window.DockGroupMeChat.isVisible());
 history.push({id:'3',user_id:'2',name:'Alex',text:'Arrived while minimized',created_at:1700000004,favorited_by:[]});
 await appFrame.evaluate(()=>document.getElementById('refresh-groups').click());await page.waitForFunction(()=>document.querySelector('#taskbar-open .groupme-unread-count')?.textContent==='1');
 const read=await appFrame.evaluate(()=>JSON.parse(localStorage.getItem('dock-groupme-read-v1'))['groups:123'].count);assert.equal(read,2,'Minimized arrival stays unread');
 await page.locator('#taskbar-open button').click();await appFrame.waitForFunction(()=>window.DockGroupMeChat.isVisible());await appFrame.evaluate(()=>document.getElementById('refresh').click());await chat.getByText('Arrived while minimized',{exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('.groupme-unread-count'));
 assert.equal(await appFrame.evaluate(()=>JSON.parse(localStorage.getItem('dock-groupme-read-v1'))['groups:123'].count),3);
 assert.deepEqual(errors,[]);console.log('PASS actual Desktop/GroupMe frames: minimized focus, new message unread count, taskbar badge, restore, refresh/read clears badge. Mock GroupMe only.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
