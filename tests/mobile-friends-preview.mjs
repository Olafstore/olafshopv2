// Real storefront renderers and friends client, with isolated non-production fixtures.
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {sample,storefront} from './storefront-fixture.mjs';
const root=new URL('../',import.meta.url),app=storefront();
const read=f=>readFileSync(new URL(f,root),'utf8');
const head=read('index.html').split('<body')[0].replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const products=sample.map((p,i)=>({...p,image:'/art/'+i,heroImage:'/art/'+i}));
const fixture=`<script>
window.OlafStore={ready:Promise.resolve(),currentUser:()=>({id:'fixture',displayName:'OLAF Player'})};
window.olafSupabase={rpc:async(name,args)=>({data:name==='shop_friend_heartbeat'?{incoming:2}:name==='shop_friends_list'?[{username:'Aurora',nickname:'Aurora',online:true},{username:'Cloud',nickname:'Cloud',online:false}]:{}})};
document.addEventListener('DOMContentLoaded',()=>{
document.querySelector('.site-theme-profile-control').innerHTML=OlafTheme.controlMarkup();
const slides=[...document.querySelectorAll('[data-steam-activity-slide]')];let current=0;
function show(n){current=(n+slides.length)%slides.length;document.querySelector('[data-steam-activity-track]').style.setProperty('--activity-index',current);slides.forEach((s,i)=>{s.classList.toggle('is-active',i===current);s.inert=i!==current;s.setAttribute('aria-hidden',i!==current)});document.querySelectorAll('[data-steam-activity-dot]').forEach((d,i)=>d.classList.toggle('is-active',i===current));}
document.querySelectorAll('[data-steam-activity-step]').forEach(b=>b.onclick=()=>show(current+Number(b.dataset.steamActivityStep)));
document.querySelectorAll('[data-steam-activity-dot]').forEach(b=>b.onclick=()=>show(Number(b.dataset.steamActivityDot)));
});</script><script src="/site-theme.js"></script><script src="/friends.js"></script>`;
const html=head+`<body class="home-page"><header class="topbar site-topbar-unified"><a class="brand">OLAF</a><div class="topbar-actions"><button class="site-global-search-toggle" aria-label="ค้นหา">⌕</button><button id="open-notifications" aria-label="แจ้งเตือน">♧</button><button id="open-favorites" aria-label="รายการโปรด">♡</button><button id="open-auth" aria-label="บัญชี">♙</button><button class="mobile-nav-toggle" aria-label="เมนู">☰</button></div></header><main style="padding:100px 14px 30px;max-width:1100px;margin:auto">${app.steamActivityCarouselMarkup(products)}<section style="margin-top:40px"><h2>ตัวเลือกหน้าโปรไฟล์ (ข้อมูลทดสอบ)</h2><div class="site-theme-profile-control"></div></section></main>${fixture}</body></html>`;
createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;if(path==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);return;}if(path.startsWith('/art/')){res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="500"><defs><linearGradient id="g"><stop stop-color="#205598"/><stop offset="1" stop-color="#0c172b"/></linearGradient></defs><rect width="600" height="500" fill="url(#g)"/><text x="35" y="240" fill="white" font-family="sans-serif" font-size="38">GAME '+path.slice(5)+'</text></svg>');return;}const file=path.slice(1);if(!/^[\w-]+\.(css|js)$/.test(file)||file.endsWith('.js')&&!['site-theme.js','friends.js'].includes(file)){res.writeHead(404).end();return;}try{res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'application/javascript');res.end(read(file));}catch{res.writeHead(404).end();}}).listen(8771,'127.0.0.1',()=>console.log('Mobile/friends fixture http://127.0.0.1:8771'));
