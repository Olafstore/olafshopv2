import { testSandboxConnection, SupplierConnectionError } from '../lib/suppliers/499k/client.js';
import { requireSupplierAdmin } from '../lib/suppliers/admin-access.js';

export function createHandler({ env = process.env, fetcher = fetch, now = Date.now } = {}) {
  let nextAllowed = 0;
  let running = false;
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const reply = (status, body) => res.status(status).json(body);
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return reply(405, { success: false, code: 'METHOD_NOT_ALLOWED' });
    }
    let acquired = false;
    try {
      await requireSupplierAdmin(req, { env, fetcher });
      // Disabled by default until existing profiles role-update protections are verified.
      if (env.SUPPLIER_499K_TEST_ENABLED !== 'true') throw new SupplierConnectionError('SUPPLIER_TEST_DISABLED', 503);
      if (running || now() < nextAllowed) throw new SupplierConnectionError('TEST_RATE_LIMITED', 429, Math.max(1, Math.ceil((nextAllowed - now()) / 1000)));
      running = true;
      acquired = true;
      nextAllowed = now() + 10000;
      return reply(200, await testSandboxConnection({ env, fetcher }));
    } catch (caught) {
      const error = caught instanceof SupplierConnectionError ? caught : new SupplierConnectionError('SUPPLIER_TEST_FAILED', 503);
      if (error.retryAfter) {
        res.setHeader('Retry-After', String(error.retryAfter));
        if (acquired) nextAllowed = Math.max(nextAllowed, now() + error.retryAfter * 1000);
      }
      // Allowlisted metadata only. Never echo exceptions, upstream bodies, or headers.
      return reply(error.status, { success: false, supplier: '499k', mode: 'sandbox', connected: false, code: error.code });
    } finally {
      if (acquired) running = false;
    }
  };
}
export default createHandler();
