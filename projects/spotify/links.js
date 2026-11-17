export function parseSpotify(value){
 const input=String(value).trim();let match=input.match(/^spotify:(track|album|playlist|artist|show|episode):([a-zA-Z0-9]{22})$/);
 if(!match){try{const url=new URL(input);if(url.protocol!=='https:'||url.hostname!=='open.spotify.com'||url.username||url.password||url.port)return null;match=url.pathname.match(/^\/(?:intl-[a-z-]+\/)?(track|album|playlist|artist|show|episode)\/([a-zA-Z0-9]{22})\/?$/)}catch{return null}}
 return match?{type:match[1],id:match[2],url:'https://open.spotify.com/'+match[1]+'/'+match[2],embed:'https://open.spotify.com/embed/'+match[1]+'/'+match[2]}:null;
}
