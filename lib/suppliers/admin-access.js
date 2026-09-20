import { SupplierConnectionError } from './499k/client.js';

export async function requireSupplierAdmin(req, { env = process.env, fetcher = fetch } = {}) {
  const token = /^Bearer ([^\s]+)$/i.exec(req.headers?.authorization || '')?.[1];
  if (!token) throw new SupplierConnectionError('AUTH_REQUIRED', 401);
  const base = env.SUPABASE_URL || '';
  const publicKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  // Existing OLAF project; no client-supplied host, user ID, or role is accepted.
  if (base.replace(/\/$/, '') !== 'https://wtvfgwacodfrzxapwoxj.supabase.co' || !publicKey || !serviceKey) {
    throw new SupplierConnectionError('SERVER_CONFIG_REQUIRED', 503);
  }
  try {
    const auth = await fetcher(`${base.replace(/\/$/, '')}/auth/v1/user`, {
      redirect: 'error', signal: AbortSignal.timeout(4000),
      headers: { apikey: publicKey, Authorization: `Bearer ${token}` }
    });
    if (!auth.ok) throw new SupplierConnectionError('AUTH_REQUIRED', 401);
    const user = await auth.json();
    if (!/^[0-9a-f-]{36}$/i.test(user?.id || '')) throw new SupplierConnectionError('AUTH_REQUIRED', 401);
    const query = new URLSearchParams({ select: 'id,role,status', id: `eq.${user.id}`, limit: '1' });
    const profile = await fetcher(`${base.replace(/\/$/, '')}/rest/v1/profiles?${query}`, {
      redirect: 'error', signal: AbortSignal.timeout(4000),
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: 'application/json' }
    });
    if (!profile.ok) throw new SupplierConnectionError('ADMIN_CHECK_UNAVAILABLE', 503);
    const rows = await profile.json();
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0].id !== user.id
      || rows[0].role !== 'admin' || rows[0].status !== 'active') {
      throw new SupplierConnectionError('ADMIN_REQUIRED', 403);
    }
    return user.id;
  } catch (error) {
    if (error instanceof SupplierConnectionError) throw error;
    throw new SupplierConnectionError('ADMIN_CHECK_UNAVAILABLE', 503);
  }
}
