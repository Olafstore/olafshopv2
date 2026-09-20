// Local-only fixture: production markup/styles, synthetic products, no account/network writes.
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {sample,storefront} from './storefront-fixture.mjs';
const app=storefront(),allowed=new Set(['styles.css','site-theme-surfaces.css','home-store-polish.css','profile-level.css','profile-level.js']);
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const stats=index.slice(index.indexOf('<section class="stats-strip"'),index.indexOf('<section class="olaf-steam-storefront"'));
createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),file=url.pathname.slice(1);
 if(allowed.has(file)){res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'application/javascript');return res.end(readFileSync(new URL('../'+file,import.meta.url)));}
 if(file.startsWith('art/')){const i=Number(file.split('/')[1])%8;res.setHeader('Content-Type','image/svg+xml');return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><defs><linearGradient id="g"><stop stop-color="#264e70"/><stop offset="1" stop-color="#07121e"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><rect x="8" y="8" width="1584" height="884" fill="none" stroke="#74b9ee" stroke-width="16"/><text x="800" y="450" text-anchor="middle" fill="white" font-size="70">${sample[i].name}</text></svg>`);}
 if(file&&file!=='preview'){res.writeHead(404).end();return;}
 res.setHeader('Content-Type','text/html;charset=utf-8');res.end(`<!doctype html><html lang="th" data-site-theme="store"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Layout regression fixture</title>${[...allowed].filter(f=>f.endsWith('.css')).map(f=>`<link rel="stylesheet" href="/${f}">`).join('')}<body class="home-page"><div id="profile-overview-root"><div class="member-identity"><h2>TEST USER</h2></div></div><section class="home-free-games"><div class="home-free-games-heading"><h2>เกมฟรีที่กำลังรับได้</h2></div><div class="home-free-games-rail">ข้อมูลตัวอย่าง</div></section>${stats}<section id="olaf-steam-storefront" class="olaf-steam-storefront"><header class="olaf-steam-section-head"><div><p>OLAF STORE HIGHLIGHTS</p><h2>สินค้าเด่นและแนะนำ</h2></div></header><div class="olaf-steam-spotlight-stage">${app.steamSpotlightMarkup(sample[0],sample)}</div><div class="olaf-steam-section-head is-deals"><div><p>SPECIAL OFFERS</p><h2>ดีลและสินค้าน่าสนใจ</h2></div></div><div class="olaf-steam-deals-track"><img src="/art/2" width="250" alt="ดีลตัวอย่าง"></div><section class="olaf-steam-taste-stack">${app.steamActivityCarouselMarkup(sample)}</section></section><script>
const products=${JSON.stringify(sample)};let current=0;
document.addEventListener('click',e=>{const b=e.target.closest('[data-steam-activity-step]');if(!b)return;current=(current+Number(b.dataset.steamActivityStep)+4)%4;document.querySelector('[data-steam-activity-track]').style.setProperty('--activity-index',current);document.querySelectorAll('[data-steam-activity-slide]').forEach((s,i)=>{s.classList.toggle('is-active',i===current);s.inert=i!==current;s.setAttribute('aria-hidden',String(i!==current));});});
window.OlafStore={currentUser:()=>({id:'test'})};window.olafSupabase={rpc:async()=>({data:{level:21,progress:75}})};
</script><script src="/profile-level.js"></script><script>window.dispatchEvent(new Event('olaf-profile-ready'));</script></body></html>`);
}).listen(8768,'127.0.0.1',()=>console.log('Local layout fixture http://127.0.0.1:8768/preview'));
