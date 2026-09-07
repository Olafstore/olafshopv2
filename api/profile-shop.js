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

export function backgroundFolderPrice(name) {
  if (!/^\d+(?:\.\d+)?k?$/i.test(name)) return null;
  const value = Number(name.replace(/k$/i, '')) * (/k$/i.test(name) ? 1000 : 1);
  return Number.isSafeInteger(value) && value > 0 && value <= 10000000 ? value : null;
}

export async function scanBackgroundCatalog(root = process.cwd()) {
  const base = 'iconprofile/BGolaf';
  const entries = async folder => {
    try { return await readdir(path.join(root, folder), { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  };
  const images = async (folder, price) => (await entries(folder))
    .filter(entry => entry.isFile() && imageName.test(entry.name))
    .map(entry => ({ id: `${folder}/${entry.name}`, name: entry.name.replace(/\.[^.]+$/, ''),
      image: `api/profile-avatar?id=${encodeURIComponent(`${folder}/${entry.name}`)}`, price, kind: 'background' }));
  const catalog = await images(base, 0);
  for (const entry of await entries(`${base}/BGpoint`)) {
    const price = backgroundFolderPrice(entry.name);
    if (entry.isDirectory() && price !== null) catalog.push(...await images(`${base}/BGpoint/${entry.name}`, price));
  }
  return catalog.sort((a,b) => a.price-b.price || a.name.localeCompare(b.name,'en',{numeric:true}));
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
  let stage = 'catalog';
  try {
    const catalog = [...await scanAvatarCatalog(), ...await scanBackgroundCatalog()];
    if (req.method === 'GET') return reply(res, 200, { catalog });
    const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || !service) return reply(res, 503, { error: 'SHOP_CONFIG_REQUIRED' });
    const token = /^Bearer (.+)$/i.exec(req.headers.authorization || '')?.[1];
    if (!token) return reply(res, 401, { error: 'AUTH_REQUIRED' });
    stage = 'authentication';
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
      stage = name;
      const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: 'POST', headers: { apikey: admin ? service : key,
          Authorization: `Bearer ${admin ? service : token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(params), signal: AbortSignal.timeout(15000)
      });
      // shop_register_avatar RETURNS void: PostgREST correctly sends 204 with no JSON body.
      // Only registration may omit a result; purchase/equip must return the wallet state.
      if (response.status === 204 && response.ok && ['shop_register_avatar','shop_register_background'].includes(name)) return null;
      let result;
      try { result = await response.json(); }
      catch { throw new Error('SHOP_DATABASE_RESPONSE_INVALID'); }
      if (!response.ok) throw Object.assign(new Error(result.message || 'SHOP_UNAVAILABLE'), {
        status: response.status, databaseCode: result.code
      });
      return result;
    };
    let state;
    if (avatar.kind === 'background') {
      await rpc('shop_register_background', { p_id: avatar.id, p_price: avatar.price }, true);
      state = await rpc('shop_use_background', { p_id: avatar.id, p_purchase: body.action === 'purchase' });
    } else {
      await rpc('shop_register_avatar', { p_id: avatar.id, p_path: avatar.id }, true);
      state = await rpc(body.action === 'purchase' ? 'shop_purchase_avatar' : 'shop_equip_avatar', { p_avatar: avatar.id });
    }
    return reply(res, 200, { state });
  } catch (error) {
    const databaseCode = /^[A-Z0-9]{5,12}$/.test(error.databaseCode || '') ? error.databaseCode : undefined;
    const code = ['SHOP_POINTS_INSUFFICIENT','AVATAR_NOT_OWNED','AVATAR_NOT_FOUND','AUTH_REQUIRED','ACCESS_DENIED']
      .find(value => String(error.message).includes(value))
      || (['PGRST202','PGRST205','42883','42P01'].includes(databaseCode) ? 'SHOP_SCHEMA_NOT_READY'
        : databaseCode === '42501' ? 'SHOP_DATABASE_PERMISSION'
        : ['TimeoutError','AbortError'].includes(error.name) ? 'SHOP_TIMEOUT'
        : stage === 'catalog' ? 'SHOP_ASSETS_MISSING'
        : databaseCode ? 'SHOP_DATABASE_ERROR' : 'SHOP_UNAVAILABLE');
    // Log only diagnostic labels, never tokens, customer data or provider payloads.
    console.error('Profile shop request failed', { code, stage, databaseCode });
    return reply(res, code.startsWith('SHOP_') && code !== 'SHOP_POINTS_INSUFFICIENT' ? 503 : 400,
      { error: code, diagnostic: { stage, databaseCode } });
  }
}
