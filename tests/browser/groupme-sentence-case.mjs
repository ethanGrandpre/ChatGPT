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
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();let response={};if(url.pathname.includes('project-sync'))response={entries:{},revision:1};else if(url.pathname.includes('groupme-push'))response={chats:[],publicKey:'AQ'};else{let data=[];if(url.pathname.endsWith('/status'))data={id:'1',name:'Owner'};else if(url.pathname.endsWith('/groups'))data=[{id:'123',name:'Family',messages:{count:2,last_message_id:'2'}}];else if(url.pathname.endsWith('/topics'))data={group:{id:'123',name:'Family'},topics:[],can_manage:false};else if(url.pathname.endsWith('/messages'))data={messages:history};else if(url.pathname.endsWith('/react')){const input=route.request().postDataJSON();reactions.push(input);const message=history.find(m=>m.id===input.message);message.favorited_by=[...new Set([...message.favorited_by,'1'])];message.dock_reaction=input.emoji;data={confirmed:true,message_id:input.message,emoji:input.emoji,favorited_by:message.favorited_by}}response={release:'groupme-notify-emoji-1',response:data}}await route.fulfill({json:response})});
 await page.goto('http://127.0.0.1:'+server.address().port+'/projects/groupme-messages/run.html');
 await page.waitForFunction(()=>!!window.DockGroupMeTopics);
 await page.getByRole('button',{name:'Family',exact:true}).click();await page.locator('#topics-for-123').getByRole('button',{name:'#main',exact:true}).click();
 const incoming=page.locator('.message[data-message-id="1"]'),outgoing=page.locator('.message[data-message-id="2"]');await outgoing.waitFor();

 const input=page.locator('#text');await input.pressSequentially('h');assert.equal(await input.inputValue(),'H');await input.press('Backspace');await input.pressSequentially('h');assert.equal(await input.inputValue(),'h');await input.fill('');await input.pressSequentially('hello. world! again? yes');assert.equal(await input.inputValue(),'hello. World! Again? Yes');await input.press('Backspace');await input.press('Backspace');await input.press('Backspace');await input.pressSequentially('yes');assert.equal(await input.inputValue(),'hello. World! Again? yes');await input.press('Shift+Enter');await input.pressSequentially('next');assert.match(await input.inputValue(),/\nNext$/);const saved=await page.evaluate(()=>sessionStorage.getItem('dock-groupme-drafts-v1'));assert.match(saved,/hello. World/);assert.deepEqual(errors,[]);await page.setViewportSize({width:390,height:844});console.log('PASS real desktop typing, first-letter override, punctuation, newline, caret, and draft integration. No messages sent.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
