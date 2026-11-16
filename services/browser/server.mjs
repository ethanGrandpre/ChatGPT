import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {WebSocketServer,WebSocket} from 'ws';
import {startEgress} from './egress.mjs';

const HOME='https://www.google.com/';
export function target(input){const text=String(input||'').trim();if(!text||text.length>4096)throw Error('Enter a shorter website address or search.');let u;try{u=new URL(text)}catch{}if(!u&&/^\S+\.\S+$/.test(text))u=new URL('https://'+text);if(!u)return 'https://www.google.com/search?q='+encodeURIComponent(text);if(u.protocol!=='https:'||u.username||u.password)throw Error('Only HTTPS websites without embedded credentials are supported.');return u.href}
function same(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
export async function createService({secret=process.env.BROWSER_SERVER_SECRET,origin=process.env.ALLOWED_ORIGIN,launchBrowser,port=Number(process.env.PORT)||8788}={}){
 if(!secret||secret.length<32||!origin||new URL(origin).origin!==origin)throw Error('Set BROWSER_SERVER_SECRET (32+ random characters) and ALLOWED_ORIGIN (exact hub origin).');
 const proxy=await startEgress();let browser,browserStarting;const clients=new Set();let starting=0;
 const launch=launchBrowser||(()=>chromium.launch({headless:true,chromiumSandbox:true,proxy:{server:proxy.url},args:['--disable-quic','--force-webrtc-ip-handling-policy=disable_non_proxied_udp','--disable-features=WebRtcHideLocalIpsWithMdns','--proxy-bypass-list=<-loopback>']}));
 const server=http.createServer((req,res)=>{res.writeHead(req.url==='/health'?200:404,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end(req.url==='/health'?'Dock browser server online':'Not found')});
 const wss=new WebSocketServer({noServer:true,maxPayload:32768,perMessageDeflate:false});
 server.on('upgrade',async(req,socket,head)=>{
  if(req.url!=='/stream'||req.headers.origin!==origin||!same(req.headers.authorization||'','Bearer '+secret)){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return}
  if(clients.size+starting>=2){socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');return}
  starting++;let context;
  try{browserStarting??=launch();browser=await browserStarting;context=await browser.newContext({viewport:{width:1200,height:760},acceptDownloads:false,serviceWorkers:'block',permissions:[]});await context.route('**/*',route=>{const protocol=new URL(route.request().url()).protocol;return ['https:','about:'].includes(protocol)?route.fallback():route.abort()});wss.handleUpgrade(req,socket,head,ws=>{starting--;clients.add(ws);session(ws,context).catch(()=>ws.close(1011,'Browser session failed'))})}
  catch{starting--;await context?.close();socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n')}
 });
 async function session(ws,context){let pages=[],active,closed=false,busy=false,chain=Promise.resolve(),lastInput=Date.now(),sequence=0;let pending=0;let lastFrame=0,queued=0;let viewport={width:1200,height:760};const send=data=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data))};
  const state=async()=>{if(closed||!active)return;send({type:'state',active:active.id,tabs:await Promise.all(pages.map(async t=>({id:t.id,title:await t.page.title().catch(()=>''),url:t.page.url()})))})};
  const add=async(url=HOME)=>{if(pages.length>=8)throw Error('Maximum of eight tabs.');const page=await context.newPage();await page.setViewportSize(viewport);const tab={id:++sequence,page};pages.push(tab);active=tab;page.on('popup',popup=>popup.close().catch(()=>{}));page.on('dialog',dialog=>dialog.dismiss().catch(()=>{}));page.on('framenavigated',frame=>{if(frame===page.mainFrame())state().catch(()=>{})});page.on('download',download=>download.cancel());page.goto(url,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>send({type:'error',message:'Page could not finish loading. Try another address or reload.'}));await state()};
  const timer=setInterval(async()=>{if(closed||busy||!active||pending)return;if(Date.now()-lastInput>15*60*1000){ws.close(1000,'Idle session ended');return}busy=true;try{const frame=await active.page.screenshot({type:'jpeg',quality:65,timeout:5000});if(ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<512000){pending=1;lastFrame=Date.now();ws.send(frame,{binary:true})}}catch{}finally{busy=false}},180);
  const frameTimeout=setInterval(()=>{if(pending&&Date.now()-lastFrame>15000)ws.close(1000,'Stream stalled')},5000);
  const lifetime=setTimeout(()=>ws.close(1000,'Session expired; reconnect to sign in again'),30*60*1000);
  const cleanup=async()=>{if(closed)return;closed=true;clearInterval(timer);clearInterval(frameTimeout);clearTimeout(lifetime);clients.delete(ws);await context.close().catch(()=>{})};ws.on('close',cleanup);ws.on('error',cleanup);
  ws.on('message',(data,binary)=>{if(binary)return;let m;try{m=JSON.parse(data.toString())}catch{return}if(!m||typeof m!=='object'||typeof m.type!=='string')return;if(m.type==='ack'){pending=0;return}if(queued>=40){ws.close(1008,'Too many input events');return}lastInput=Date.now();queued++;chain=chain.then(async()=>{if(closed)return;const page=active?.page;if(!page)return;
   if(m.type==='navigate')await page.goto(target(m.value),{waitUntil:'domcontentloaded',timeout:30000});
   else if(m.type==='new')await add('about:blank');
   else if(m.type==='select'){const t=pages.find(t=>t.id===m.id);if(t)active=t}
   else if(m.type==='close'){const t=pages.find(t=>t.id===m.id);if(t){pages=pages.filter(p=>p!==t);await t.page.close();if(active===t)active=pages[0];if(!active)await add('about:blank')}}
   else if(m.type==='back')await page.goBack({waitUntil:'domcontentloaded',timeout:15000});
   else if(m.type==='forward')await page.goForward({waitUntil:'domcontentloaded',timeout:15000});
   else if(m.type==='reload')await page.reload({waitUntil:'domcontentloaded',timeout:15000});
   else if(m.type==='resize'){const width=Math.round(Math.max(360,Math.min(1600,Number(m.width)||1200))),height=Math.round(Math.max(300,Math.min(1000,Number(m.height)||760)));viewport={width,height};await Promise.all(pages.map(t=>t.page.setViewportSize(viewport)));}
   else if(m.type==='click'){const size=page.viewportSize();if(Number.isFinite(m.x)&&Number.isFinite(m.y)&&m.x>=0&&m.y>=0&&m.x<=size.width&&m.y<=size.height)await page.mouse.click(m.x,m.y)}
   else if(m.type==='wheel'){await page.mouse.wheel(Math.max(-1500,Math.min(1500,Number(m.x)||0)),Math.max(-1500,Math.min(1500,Number(m.y)||0)))}
   else if(m.type==='text'){if(typeof m.value==='string'&&m.value.length<=4000)await page.keyboard.insertText(m.value)}
   else if(m.type==='key'){if(['Enter','Backspace','Tab','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Delete','Home','End','PageUp','PageDown','ControlOrMeta+A'].includes(m.value))await page.keyboard.press(m.value)}
   await state();
  }).catch(()=>send({type:'error',message:'That action could not be completed.'})).finally(()=>{queued--;});});
  await add();
 }
 await new Promise(r=>server.listen(port,'127.0.0.1',r));return{server,port:server.address().port,close:async()=>{for(const ws of clients)ws.terminate();wss.close();await browser?.close();await new Promise(r=>server.close(r));await proxy.close()}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const service=await createService();console.log(`Browser server listening on http://127.0.0.1:${service.port}`);for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>service.close().then(()=>process.exit(0)))}
