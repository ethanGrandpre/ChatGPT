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
 for(const [row,own]of [[incoming,false],[outgoing,true]]){
  const geometry=await row.evaluate(e=>{const r=e.getBoundingClientRect(),p=e.querySelector('p').getBoundingClientRect(),b=e.querySelector('.message-reaction-badge').getBoundingClientRect();return{row:{left:r.left,right:r.right},bubble:{bottom:p.bottom},badge:{left:b.left,right:b.right,top:b.top,bottom:b.bottom}}});
  assert.ok(geometry.badge.top<geometry.bubble.bottom&&geometry.badge.bottom>geometry.bubble.bottom,'Badge overlaps bubble bottom');
  assert.ok(own?geometry.badge.left<geometry.row.left+20:geometry.badge.right>geometry.row.right-20,'Badge offset toward center');
 }
 const tap=async row=>{const b=await row.locator('p').boundingBox();await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2)};
 await tap(incoming);await tap(incoming);await page.waitForFunction(()=>document.querySelector('[data-message-id="1"] .message-reaction-badge')?.getAttribute('aria-pressed')==='true');
 assert.equal(reactions.length,1);assert.equal(reactions[0].emoji,'❤️');assert.equal(reactions[0].liked,true);await tap(incoming);await tap(incoming);assert.equal(reactions.length,1,'Double tap never removes an existing heart');
 const cdp=await page.context().newCDPSession(page);
 const swipe=async(row,dx,dy=0)=>{const b=await row.locator('p').boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/6,y:y+dy*i/6}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})};
 await swipe(incoming,70);await page.waitForFunction(()=>!document.getElementById('reply-bar').hidden);assert.match(await page.locator('#reply-preview').textContent(),/Alex.*incoming/);await page.locator('#cancel-reply').click();
 await swipe(outgoing,-70);await page.waitForFunction(()=>!document.getElementById('reply-bar').hidden);assert.match(await page.locator('#reply-preview').textContent(),/Owner.*outgoing/);await page.locator('#cancel-reply').click();
 await swipe(incoming,-65);assert.equal(await page.locator('#reply-bar').isHidden(),true,'Wrong direction does not reply');
 await swipe(incoming,5,65);assert.equal(await page.locator('#reply-bar').isHidden(),true,'Vertical scrolling does not reply');assert.equal(reactions.length,1,'Swipes do not react');
 assert.equal(await page.locator('.message[data-swiping]').count(),0,'Gesture styles cleaned up');
 await incoming.locator('p').evaluate(e=>{e.parentElement.onpointerdown({pointerType:'touch',pointerId:7,clientX:100,clientY:100,target:e});e.parentElement.onpointercancel()});assert.equal(await page.locator('.message[data-swiping]').count(),0);

 // Controls retain native behavior instead of becoming message gestures.
 await outgoing.evaluate(row=>{const target=document.createElement('a');target.href='#attachment';row.querySelector('p').append(target);for(let i=0;i<2;i++){row.onpointerdown({pointerType:'touch',pointerId:9,clientX:100,clientY:100,target});row.onpointerup({pointerId:9,clientX:100,clientY:100})}target.remove();const button=row.querySelector('.message-reaction-badge');row.onpointerdown({pointerType:'touch',pointerId:10,clientX:200,clientY:100,target:button});row.onpointermove({pointerId:10,clientX:130,clientY:100,preventDefault(){}});row.onpointerup({pointerId:10,clientX:130,clientY:100})});
 assert.equal(reactions.length,1,'Links and reaction controls never trigger message gestures');assert.equal(await page.locator('#reply-bar').isHidden(),true);
 await page.screenshot({path:'work/groupme-gestures-mobile.png'});
 await page.setViewportSize({width:1440,height:900});await page.mouse.move(1000,50);await page.screenshot({path:'work/groupme-gestures-desktop.png'});
 assert.deepEqual(errors,[]);console.log('PASS attached reaction badges, confirmed double-tap hearts, no duplicate/removal, inward swipe reply for incoming/outgoing, wrong direction, scrolling, cancellation, mobile and desktop layout. Mock GroupMe only.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
