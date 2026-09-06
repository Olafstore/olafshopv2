import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { scanAvatarCatalog } from './profile-shop.js';

export default async function handler(req, res) {
  if (!['GET','HEAD'].includes(req.method)) { res.setHeader('Allow','GET, HEAD'); return res.status(405).end(); }
  try {
    const id = new URL(req.url, 'https://local.invalid').searchParams.get('id');
    const item = (await scanAvatarCatalog()).find(entry => entry.id === id);
    if (!item) return res.status(404).end();
    const file = path.join(process.cwd(), item.id);
    const info = await stat(file);
    const etag = `"avatar-v1-${info.size}-${Math.floor(info.mtimeMs)}"`;
    res.setHeader('Cache-Control','public, max-age=0, must-revalidate');
    res.setHeader('ETag',etag);
    res.setHeader('Content-Type','image/webp');
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    if (req.method === 'HEAD') return res.status(200).end();
    const output = await sharp(await readFile(file), { limitInputPixels:25000000 }).rotate()
      .resize(320,320,{ fit:'cover', withoutEnlargement:true }).webp({ quality:82 }).toBuffer();
    return res.status(200).end(output);
  } catch { return res.status(503).end(); }
}
