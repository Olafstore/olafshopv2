import {readFileSync} from 'node:fs';
import {getProducts,metadata,escape} from '../lib/seo.js';
const template=readFileSync(new URL('../product.html',import.meta.url),'utf8');
export function renderProduct(product){const m=metadata(product);return template.replace(/<title>[\s\S]*?<\/title>/i,m.html).replace(/<main id="product-page">[\s\S]*?<\/main>/,`<main id="product-page"><section class="pd-layout" style="padding:32px"><div><h1>${escape(m.name)}</h1><img src="${escape(m.image)}" alt="${escape(m.name)}" style="max-width:100%;height:auto"><p>${escape(m.description)}</p><a href="/index.html#catalog">ดูเกมทั้งหมดในร้าน</a></div></section></main>`);}
export default async function handler(req,res){
 if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return res.status(405).end();}
 res.setHeader('Content-Type','text/html; charset=utf-8');
 const id=new URL(req.url,'https://olafshop.com').searchParams.get('id');
 if(!id||id.length>180||/[\x00-\x1f\x7f/\\]/.test(id)){res.setHeader('X-Robots-Tag','noindex');return res.status(404).end('ไม่พบสินค้า');}
 try{const [product]=await getProducts(id);if(!product){res.setHeader('X-Robots-Tag','noindex');return res.status(404).end('ไม่พบสินค้า');}
 res.setHeader('Cache-Control','public, max-age=0, s-maxage=300');return res.status(200).end(req.method==='HEAD'?'':renderProduct(product));
 }catch{res.setHeader('Cache-Control','no-store');res.setHeader('Retry-After','60');return res.status(503).end('โหลดสินค้าไม่สำเร็จ กรุณาลองใหม่');}
}
