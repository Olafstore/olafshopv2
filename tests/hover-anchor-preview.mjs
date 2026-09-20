import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const html=`<!doctype html><html lang="th" data-site-theme="main"><meta charset="utf-8"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/product-hover.css"><link rel="stylesheet" href="/site-theme-surfaces.css"><style>body{padding:70px!important}main{display:grid;grid-template-columns:repeat(4,270px);gap:20px}article.product-card{height:300px}article img{width:100%}article h3{padding:12px}</style><body><h1>ทดสอบมินิการ์ด</h1><main>${['product-card','olaf-steam-editorial-card','catalog-genre-game','product-card'].map((cls,i)=>`<article class="${cls}"><a href="/product.html?id=test${i}"><img src="/cover.svg"><h3>ทดสอบสินค้า ${i+1}</h3></a></article>`).join('')}</main><script>window.OlafProducts={fetchProductById:async id=>({id,name:'PC Building Simulator',image:'/cover.svg',gallery:['/gallery.svg','/gallery2.svg'],price:39,compareAt:400,stock:3,tags:['จำลองสถานการณ์','ผู้เล่นคนเดียว','Steam'],rating:'แง่บวกเป็นอย่างมาก | 52,537 รีวิว'})};</script><script src="/product-hover.js"></script></body></html>`;
createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/'){
  const shape=new URL(req.url,'http://localhost').searchParams.get('shape');
  const size=shape==='short'?[440,220]:shape==='wide'?[670,420]:[270,300];
  const styled=html.replace('</style>',`main{grid-template-columns:repeat(2,${size[0]}px)}main>article{width:${size[0]}px;height:${size[1]}px!important;overflow:hidden}</style>`);
  res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(styled.replace('</main>','</main><button onclick="document.querySelector(\'article\').dispatchEvent(new PointerEvent(\'pointerover\',{bubbles:true,pointerType:\'mouse\'}))">แสดงตัวอย่างทดสอบ</button>'));
 }
 if(['/gallery.svg','/gallery2.svg','/cover.svg'].includes(path)){
  res.setHeader('Content-Type','image/svg+xml');return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="${path==='/cover.svg'?'#602955':'#165575'}"/><rect x="8" y="8" width="1904" height="1064" fill="none" stroke="#71d5ff" stroke-width="16"/><text x="960" y="560" text-anchor="middle" fill="white" font-family="sans-serif" font-size="150">${path.slice(1)}</text></svg>`);
 }
 if(!['/styles.css','/product-hover.css','/site-theme-surfaces.css','/product-hover.js'].includes(path))return res.writeHead(404).end();
 res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(new URL(path.slice(1),root)));
}).listen(8776,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:8776'));
