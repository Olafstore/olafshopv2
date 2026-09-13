import {readFileSync} from 'node:fs';
import {getProducts,metadata,escape} from '../lib/seo.js';
const template=readFileSync(new URL('../product.html',import.meta.url),'utf8');
export function renderProduct(product){
 const m=metadata(product);
 const skeleton=template.match(/<main id="product-page">([\s\S]*?)<\/main>/)?.[1]||'';
 // Keep a real readable server summary when scripting is disabled or fails.
 // The normal product renderer replaces the entire main when data is ready.
 const loading='<style>.product-server-skeleton{display:none}html.product-loading .product-server-skeleton{display:block}html.product-loading .product-server-summary{display:none}@media(prefers-reduced-motion:reduce){.product-server-skeleton .skeleton-box,.product-server-skeleton .skeleton-box::after{animation:none!important}}</style><script>document.documentElement.classList.add("product-loading");setTimeout(function(){document.documentElement.classList.remove("product-loading")},12000);</script>';
 return template.replace(/<title>[\s\S]*?<\/title>/i,m.html+loading).replace(/<main id="product-page">[\s\S]*?<\/main>/,`<main id="product-page"><div class="product-server-skeleton" role="status" aria-label="กำลังโหลดรายละเอียดสินค้า"><div aria-hidden="true">${skeleton}</div></div><section class="pd-layout product-server-summary" style="padding:32px"><div><h1>${escape(m.name)}</h1><img src="${escape(m.image)}" alt="${escape(m.name)}" style="max-width:100%;height:auto"><p>${escape(m.description)}</p><a href="/index.html#catalog">ดูเกมทั้งหมดในร้าน</a></div></section></main>`);
}
export default async function handler(req,res){
 if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return res.status(405).end();}
 res.setHeader('Content-Type','text/html; charset=utf-8');
 const id=new URL(req.url,'https://olafshop.com').searchParams.get('id');
 if(!id||id.length>180||/[\x00-\x1f\x7f/\\]/.test(id)){res.setHeader('X-Robots-Tag','noindex');return res.status(404).end('ไม่พบสินค้า');}
 try{const [product]=await getProducts(id);if(!product){res.setHeader('X-Robots-Tag','noindex');return res.status(404).end('ไม่พบสินค้า');}
 res.setHeader('Cache-Control','public, max-age=0, s-maxage=300');return res.status(200).end(req.method==='HEAD'?'':renderProduct(product));
 }catch{res.setHeader('Cache-Control','no-store');res.setHeader('Retry-After','60');return res.status(503).end('โหลดสินค้าไม่สำเร็จ กรุณาลองใหม่');}
}
