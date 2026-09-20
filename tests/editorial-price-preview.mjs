import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {editorialContext} from './editorial-test-context.mjs';
const root=new URL('../',import.meta.url),read=f=>readFileSync(new URL(f,root),'utf8');
const context=editorialContext();context.fastImg=()=> 'src="/art.svg"';
const products=JSON.parse(read('api/products.json')).products;
const styles=[...read('index.html').matchAll(/<link rel="stylesheet" href="([^"?]+\.css)(?:\?[^"\s]*)?"/g)].map(m=>m[1]).filter(f=>!f.includes('://'));
const cards=context.steamEditorialCollectionsMarkup(products);
const deals=products.filter(p=>p.stock>0).slice(0,6).map(p=>context.steamDealCardMarkup(p)).join('');
const html=`<!doctype html><html lang="th" data-site-theme="main"><meta charset="utf-8">${styles.map(f=>`<link rel="stylesheet" href="/${f}">`).join('')}<style>body{padding:24px}main{max-width:1400px;margin:auto}</style><body class="home-page"><main><h2>ดีลและสินค้าน่าสนใจ</h2><div class="olaf-steam-deals-track">${deals}</div>${cards}</main></body></html>`;
createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(html.replace('<meta charset="utf-8">','<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media(max-width:640px){body{padding:12px!important}}</style>'));}
 if(path==='/art.svg'){res.setHeader('Content-Type','image/svg+xml');return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><defs><linearGradient id="g"><stop stop-color="#24576b"/><stop offset="1" stop-color="#193059"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><text x="800" y="490" fill="#87bedb" text-anchor="middle" font-size="100" font-family="sans-serif">GAME ARTWORK</text></svg>');}
 if(!styles.includes(path.slice(1)))return res.writeHead(404).end();
 res.setHeader('Content-Type','text/css');res.end(read(path.slice(1)));
}).listen(8777,'127.0.0.1');
