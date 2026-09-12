import catalog from '../assets/products-index.json' with {type:'json'};
export default function handler(req,res){
 if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return res.status(405).end();}
 const match=String(catalog.store?.siteIconUrl||'').match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/);
 if(!match)return res.status(404).end();
 const image=Buffer.from(match[2],'base64');res.setHeader('Content-Type','image/'+match[1]);res.setHeader('Content-Length',image.length);res.setHeader('Cache-Control','public, max-age=3600');res.status(200).end(req.method==='HEAD'?undefined:image);
}
