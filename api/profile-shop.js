import { readdir } from 'node:fs/promises';
import path from 'node:path';

const imageName = /^[^/\\<>"\x00-\x1f]+\.(png|jpe?g|webp|gif|avif)$/;
export async function scanAvatarCatalog(root = process.cwd()) {
  const read = async (folder, price) => {
    const entries = await readdir(path.join(root, folder), { withFileTypes: true });
    return entries.filter(entry => entry.isFile() && imageName.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
      .map(entry => ({ id: `${folder}/${entry.name}`, name: entry.name.replace(/\.[^.]+$/, ''),
        image: `api/profile-avatar?id=${encodeURIComponent(`${folder}/${entry.name}`)}`, price }));
  };
  const [free, paid] = await Promise.all([read('iconprofile', 0), read('iconprofile/iconpoint', 1000)]);
  return [...free, ...paid];
}

function reply(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return reply(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const catalog = await scanAvatarCatalog();
    if (req.method === 'GET') return reply(res, 200, { catalog });
    const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || !service) return reply(res, 503, { error: 'SHOP_CONFIG_REQUIRED' });
    const token = /^Bearer (.+)$/i.exec(req.headers.authorization || '')?.[1];
    if (!token) return reply(res, 401, { error: 'AUTH_REQUIRED' });
    const auth = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000)
    });
    if (!auth.ok) return reply(res, 401, { error: 'AUTH_REQUIRED' });
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
    catch { return reply(res, 400, { error: 'INVALID_REQUEST' }); }
    if (!body || !['purchase', 'equip'].includes(body.action)) return reply(res, 400, { error: 'INVALID_REQUEST' });
    // Never accept a path, price, user ID or ownership flag provided by the browser.
    const avatar = catalog.find(item => item.id === body.avatarId);
    if (!avatar) return reply(res, 404, { error: 'AVATAR_NOT_FOUND' });
    const rpc = async (name, params, admin = false) => {
      const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: 'POST', headers: { apikey: admin ? service : key,
          Authorization: `Bearer ${admin ? service : token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(params), signal: AbortSignal.timeout(15000)
      });
      const result = await response.json();
      if (!response.ok) throw Object.assign(new Error(result.message || 'SHOP_UNAVAILABLE'), { status: response.status });
      return result;
    };
    await rpc('shop_register_avatar', { p_id: avatar.id, p_path: avatar.id }, true);
    const state = await rpc(body.action === 'purchase' ? 'shop_purchase_avatar' : 'shop_equip_avatar', { p_avatar: avatar.id });
    return reply(res, 200, { state });
  } catch (error) {
    const code = ['SHOP_POINTS_INSUFFICIENT','AVATAR_NOT_OWNED','AVATAR_NOT_FOUND','AUTH_REQUIRED','ACCESS_DENIED']
      .find(value => String(error.message).includes(value)) || 'SHOP_UNAVAILABLE';
    return reply(res, code === 'SHOP_UNAVAILABLE' ? 503 : 400, { error: code });
  }
}
