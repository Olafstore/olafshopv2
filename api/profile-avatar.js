import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { scanAvatarCatalog, scanBackgroundCatalog } from './profile-shop.js';

export default async function handler(req, res) {
  if (!['GET','HEAD'].includes(req.method)) { res.setHeader('Allow','GET, HEAD'); return res.status(405).end(); }
  try {
    const params = new URL(req.url, 'https://local.invalid').searchParams;
    const id = params.get('id');
    const full = params.get('view') === 'full';
    const item = [...await scanAvatarCatalog(), ...await scanBackgroundCatalog()].find(entry => entry.id === id);
    if (!item) return res.status(404).end();
    const file = path.join(process.cwd(), item.id);
    const info = await stat(file);
    const animated = path.extname(item.id).toLowerCase() === '.gif';
    const etag = `"artwork-v4-${full?'full':'card'}-${info.size}-${Math.floor(info.mtimeMs)}"`;
    res.setHeader('Cache-Control','public, max-age=0, must-revalidate');
    res.setHeader('ETag',etag);
    res.setHeader('Content-Type',animated ? 'image/gif' : 'image/webp');
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    if (req.method === 'HEAD') return res.status(200).end();
    // Preserve all GIF frames and timing for both avatars and backgrounds.
    if (animated) return res.status(200).end(await readFile(file));
    const output = await sharp(await readFile(file), { limitInputPixels:25000000 }).rotate()
      .resize(item.kind === 'background' ? 1920 : full ? 960 : 320, item.kind === 'background' ? 1080 : full ? 960 : 320,
        { fit:item.kind === 'background' || full ? 'inside' : 'cover', withoutEnlargement:true }).webp({ quality:82 }).toBuffer();
    return res.status(200).end(output);
  } catch { return res.status(503).end(); }
}
