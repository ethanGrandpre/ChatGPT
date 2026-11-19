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
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[],reactions=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('__dock_notification_setup',JSON.stringify({version:'notifications-2026-11-v4-desktop'})));
 const history=[{id:'1',user_id:'2',name:'Alex',text:'An incoming message',created_at:1700000000,favorited_by:['3','4']},{id:'2',user_id:'1',name:'Owner',text:'My outgoing message',created_at:1700000002,favorited_by:['2']}];
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();let response={};if(url.pathname.includes('project-sync'))response={entries:{},revision:1};else if(url.pathname.includes('groupme-push'))response={chats:[],publicKey:'AQ'};else{let data=[];if(url.pathname.endsWith('/status'))data={id:'1',name:'Owner'};else if(url.pathname.endsWith('/groups'))data=[{id:'123',name:'Family',messages:{count:2,last_message_id:'2'}}];else if(url.pathname.endsWith('/topics'))data={group:{id:'123',name:'Family'},topics:[],can_manage:false};else if(url.pathname.endsWith('/messages'))data={messages:history};else if(url.pathname.endsWith('/react')){const input=route.request().postDataJSON();reactions.push(input);const message=history.find(m=>m.id===input.message);message.favorited_by=[...new Set([...message.favorited_by,'1'])];message.dock_reaction=input.emoji;data={confirmed:true,message_id:input.message,emoji:input.emoji,favorited_by:message.favorited_by}}response={release:'groupme-notify-emoji-1',response:data}}await route.fulfill({json:response})});
 await page.goto('http://127.0.0.1:'+server.address().port+'/projects/groupme-messages/run.html');
 await page.waitForFunction(()=>!!window.DockGroupMeTopics);
 await page.getByRole('button',{name:'Family',exact:true}).click();await page.locator('#topics-for-123').getByRole('button',{name:'#main',exact:true}).click();
 const incoming=page.locator('.message[data-message-id="1"]'),outgoing=page.locator('.message[data-message-id="2"]');await outgoing.waitFor();

 // Save privately from the touch action panel, then reopen and search its snapshot.
 await incoming.getByRole('button',{name:'Message actions',exact:true}).click();await incoming.getByRole('button',{name:'Save message in Dock',exact:true}).click();
 await page.getByRole('button',{name:'Conversation tools',exact:true}).click();await page.getByRole('button',{name:'Saved messages',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Saved messages',exact:true});await dialog.waitFor();assert.match(await dialog.locator('#saved-list').textContent(),/An incoming message/);
 await page.locator('#saved-search').fill('missing phrase');assert.match(await page.locator('#saved-list').textContent(),/No saved messages match/);await page.locator('#saved-search').fill('Alex');assert.equal(await page.locator('#saved-list article').count(),1);
 await dialog.getByRole('button',{name:'Jump to message',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-message-id="1"]')?.dataset.replyTarget==='true');
 await page.reload();await page.getByRole('button',{name:'Family',exact:true}).click();await page.locator('#topics-for-123').getByRole('button',{name:'#main',exact:true}).click();await incoming.waitFor();
 await incoming.getByRole('button',{name:'Message actions',exact:true}).click();assert.equal(await incoming.getByRole('button',{name:'Unsave message in Dock',exact:true}).count(),1);
 await page.getByRole('button',{name:'Conversation tools',exact:true}).click();await page.getByRole('button',{name:'Saved messages',exact:true}).click();await dialog.waitFor();await page.screenshot({path:'work/groupme-saved-mobile.png'});
 // Sync event from another device replaces saved state without a reload.
 await page.evaluate(()=>{const key='dock-groupme-saved-v1',data=JSON.parse(localStorage.getItem(key));data['groups:123:2']={text:'Synced outgoing bookmark',name:'Owner',created_at:1700000002,savedAt:Date.now()};localStorage.setItem(key,JSON.stringify(data));window.dispatchEvent(new StorageEvent('storage',{key}))});assert.equal(await page.locator('#saved-list article').count(),2);
 // Synced hide choices conceal the saved text immediately.
 await page.evaluate(()=>{const key='dock-groupme-hidden-v1';localStorage.setItem(key,JSON.stringify({'groups:123:1':true}));window.dispatchEvent(new StorageEvent('storage',{key}))});assert.doesNotMatch(await page.locator('#saved-list').textContent(),/An incoming message/);assert.equal(await page.locator('#saved-list article').count(),1);
 await dialog.getByRole('button',{name:'Remove saved message',exact:true}).click();assert.match(await page.locator('#saved-list').textContent(),/No saved messages in this conversation/);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dock-groupme-saved-v1'))['groups:123:2']),false);
 await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'work/groupme-saved-desktop.png'});assert.deepEqual(errors,[]);assert.equal(reactions.length,0,'Bookmarks never send a GroupMe mutation');console.log('PASS saved snapshots, search, jump, reload persistence, synchronized updates, hidden-message privacy, removal tombstones, and responsive dialog. Mock GroupMe only.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
