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
 await page.addInitScript(()=>localStorage.setItem('__dock_notification_setup',JSON.stringify({version:'notifications-2026-11-v3'})));
 const history=Array.from({length:40},(_,i)=>({id:String(i+1),user_id:'1',name:'Owner',text:'Message '+(i+1),created_at:1700000000+i*2,favorited_by:[]}));
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();let response={};if(url.pathname.includes('project-sync'))response={entries:{},revision:1};else if(url.pathname.includes('groupme-push'))response={chats:[],publicKey:'AQ'};else{let data=[];if(url.pathname.endsWith('/status'))data={id:'1',name:'Owner'};else if(url.pathname.endsWith('/groups'))data=[{id:'123',name:'Family',messages:{count:2,last_message_id:'2'}}];else if(url.pathname.endsWith('/topics'))data={group:{id:'123',name:'Family'},topics:[],can_manage:false};else if(url.pathname.endsWith('/messages'))data={messages:history};else if(url.pathname.endsWith('/react')){const input=route.request().postDataJSON();reactions.push(input);const message=history.find(m=>m.id===input.message);message.favorited_by=[...new Set([...message.favorited_by,'1'])];message.dock_reaction=input.emoji;data={confirmed:true,message_id:input.message,emoji:input.emoji,favorited_by:message.favorited_by}}response={release:'groupme-notify-emoji-1',response:data}}await route.fulfill({json:response})});
 await page.goto('http://127.0.0.1:'+server.address().port+'/projects/groupme-messages/run.html');
 await page.waitForFunction(()=>!!window.DockGroupMeTopics);
 await page.getByRole('button',{name:'Family',exact:true}).click();await page.locator('#topics-for-123').getByRole('button',{name:'#main',exact:true}).click();
 const incoming=page.locator('.message[data-message-id="1"]'),outgoing=page.locator('.message[data-message-id="2"]');await outgoing.waitFor();


 const root=page.locator('#messages'),last=page.locator('.message[data-message-id="40"]'),previous=page.locator('.message[data-message-id="39"]');
 const settle=()=>page.evaluate(()=>new Promise(resolve=>{const start=performance.now();function tick(){if(performance.now()-start>240)resolve();else requestAnimationFrame(tick)}requestAnimationFrame(tick)}));
 for(const reduced of [false,true]){await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});await page.mouse.move(10,10);await settle();await root.evaluate(e=>e.scrollTop=e.scrollHeight);await settle();const before=await last.locator('p').boundingBox(),prior=await previous.boundingBox();const area=await root.boundingBox();await page.mouse.move(before.x+before.width/2,before.y+before.height/2);await settle();const after=await last.locator('p').boundingBox(),above=await previous.boundingBox(),tools=await last.locator('.message-actions').boundingBox();assert.ok(after.y+after.height<=area.y+area.height+1,'Bottom message stays visible '+JSON.stringify({reduced,before,after,area,above,prior,tools,scroll:await root.evaluate(e=>({top:e.scrollTop,height:e.scrollHeight,client:e.clientHeight}))}));assert.ok(Math.abs(after.y-before.y)<2,'Hovered bubble remains anchored: '+JSON.stringify({before,after}));assert.ok(above.y<prior.y-40,'Earlier messages move upward');assert.ok(tools.y>=area.y&&tools.y+tools.height<=after.y+1,'Action panel stays above the bubble');await last.getByRole('button',{name:'Save message in Dock',exact:true}).waitFor();if(!reduced)await page.screenshot({path:'work/groupme-hover-bottom.png'});await page.mouse.move(10,10);await settle()}
 assert.deepEqual(errors,[]);console.log('PASS bottom message hover expands upward with a stationary bubble and visible tools, including reduced motion. Mock GroupMe only.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
