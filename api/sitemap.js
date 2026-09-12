import {getProducts,sitemap} from '../lib/seo.js';
export default async function handler(req,res){
 if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return res.status(405).end();}
 try{const xml=sitemap(await getProducts());res.setHeader('Content-Type','application/xml; charset=utf-8');res.setHeader('Cache-Control','public, max-age=0, s-maxage=300');return res.status(200).end(req.method==='HEAD'?'':xml);}
 catch{res.setHeader('Cache-Control','no-store');return res.status(503).end('Sitemap temporarily unavailable');}
}
