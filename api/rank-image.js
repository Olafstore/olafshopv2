import path from 'node:path';
import {stat} from 'node:fs/promises';
import sharp from 'sharp';
const ranks = new Set(['brone','gold','platinum','diamonds','super','supreme']);
export default async function handler(req,res) {
  if(!['GET','HEAD'].includes(req.method)) {res.setHeader('Allow','GET, HEAD'); return res.status(405).end();}
  const rank=new URL(req.url,'https://local.invalid').searchParams.get('rank');
  if(!ranks.has(rank)) return res.status(404).end();
  try {
    const file=path.join(process.cwd(),'Rank',`${rank}.png`);
    const info=await stat(file), etag=`"rank-v1-${info.size}-${Math.floor(info.mtimeMs)}"`;
    res.setHeader('Cache-Control','public, max-age=3600'); res.setHeader('ETag',etag); res.setHeader('Content-Type','image/webp');
    if(req.headers['if-none-match']===etag) return res.status(304).end();
    if(req.method==='HEAD') return res.status(200).end();
    const output=await sharp(file,{limitInputPixels:25000000}).resize(256,256,{fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
    return res.status(200).end(output);
  } catch {return res.status(503).end();}
}
