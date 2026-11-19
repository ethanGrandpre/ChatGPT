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
 const history=[{id:'1',user_id:'2',name:'Alex',text:'An incoming message',created_at:1700000000,favorited_by:['3','4']},{id:'2',user_id:'1',name:'Owner',text:'My outgoing message',created_at:1700000002,favorited_by:['2']}];
 await page.route('**/projects.json',r=>r.fulfill({json:[]}));
 await page.route('**/api/**',r=>r.fulfill({json:{entries:{},revision:1}}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/projects/desktop/run.html');
 await page.waitForFunction(()=>document.querySelector('#start-apps button'));
 await page.locator('#pc-icons [data-project-id="dock"]').click();await page.evaluate(()=>{document.querySelector('.app-window iframe').src='/projects/groupme-messages/run.html'});await page.waitForFunction(()=>document.querySelector('.app-window iframe').contentWindow.location.pathname.startsWith('/projects/groupme-messages/'));
 const win=page.locator('[data-project-window="dock"]');await win.waitFor();
 await page.evaluate(()=>{const frame=document.querySelector('.app-window iframe');window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:frame.contentWindow,data:{type:'dock-groupme-unread',count:7}}))});
 await page.waitForFunction(()=>document.querySelector('#taskbar-open .groupme-unread-count')?.textContent==='7');
 assert.equal(await win.locator('.groupme-unread-count').textContent(),'7');
 await page.evaluate(()=>{const frame=document.querySelector('.app-window iframe');window.dispatchEvent(new MessageEvent('message',{origin:'https://untrusted.test',source:frame.contentWindow,data:{type:'dock-groupme-unread',count:99}}))});assert.equal(await win.locator('.groupme-unread-count').textContent(),'7');
 await page.screenshot({path:'work/desktop-unread-badge.png'});
 await page.evaluate(()=>{const frame=document.querySelector('.app-window iframe');window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:frame.contentWindow,data:{type:'dock-groupme-unread',count:0}}))});assert.equal(await page.locator('.groupme-unread-count').count(),0);
 console.log('PASS Desktop icon and taskbar badges, count clearing, untrusted origin rejected.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
