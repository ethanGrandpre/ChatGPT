export async function groupmeImage(request,token,network){
 const error=()=>new Response('Image unavailable',{status:502,headers:{'Cache-Control':'private, no-store'}});
 try{let url=new URL(new URL(request.url).searchParams.get('url'));if(url.origin!=='https://m.groupme.com'||!url.pathname.startsWith('/uploads/')||url.username||url.password)return new Response('Invalid image',{status:400});
 for(let hop=0;hop<4;hop++){const response=await network(new Request(url.href,{headers:url.origin==='https://m.groupme.com'?{Cookie:'token='+token}:{},redirect:'manual',signal:AbortSignal.timeout(20000)}));
 if([301,302,303,307,308].includes(response.status)){url=new URL(response.headers.get('Location'),url);if(url.protocol!=='https:'||url.username||url.password||url.port||!(['m.groupme.com','i.groupme.com'].includes(url.hostname)||/^[a-z0-9-]+\.blob\.core\.windows\.net$/.test(url.hostname)))return error();continue}
 const type=response.headers.get('Content-Type')?.split(';')[0];if(!response.ok||!['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(type))return error();return new Response(response.body,{headers:{'Content-Type':type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
 }return error()}catch{return error()}
}
