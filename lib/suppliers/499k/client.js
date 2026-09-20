// Server-only GET client. Live access is restricted to the offline catalog.
import { setTimeout as sleep } from 'node:timers/promises';

export class SupplierConnectionError extends Error {
  constructor(code, status = 502, retryAfter = 0) {
    super(code);
    this.name = 'SupplierConnectionError';
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function sandboxConfig(env = process.env) {
  if (typeof window !== 'undefined') throw new SupplierConnectionError('SERVER_ONLY', 503);
  if (env.SUPPLIER_499K_API_MODE !== 'sandbox') throw new SupplierConnectionError('SANDBOX_REQUIRED', 503);
  const base = env.SUPPLIER_499K_BASE_URL;
  if (base !== 'https://store.499k-network.com') throw new SupplierConnectionError('SUPPLIER_CONFIG_REQUIRED', 503);
  const key = env.SUPPLIER_499K_API_KEY || '';
  if (!/^499k_test_[A-Za-z0-9_-]+$/.test(key)) throw new SupplierConnectionError('SANDBOX_KEY_REQUIRED', 503);
  return { base, key };
}

export function retryAfterSeconds(value, now = Date.now()) {
  if (!value) return 1;
  const seconds = /^\d+$/.test(value.trim()) ? Number(value) : Math.ceil((Date.parse(value) - now) / 1000);
  return Number.isFinite(seconds) ? Math.max(1, seconds) : 1;
}

// Bound the body and include body reading in the request timeout.
async function readEnvelope(response, maxBytes = 65536) {
  const reader = response.body?.getReader();
  if (!reader) throw new SupplierConnectionError('SUPPLIER_INVALID_RESPONSE');
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new SupplierConnectionError('SUPPLIER_INVALID_RESPONSE');
      chunks.push(Buffer.from(value));
    }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new SupplierConnectionError('SUPPLIER_INVALID_RESPONSE');
    return data;
  } catch {
    throw new SupplierConnectionError('SUPPLIER_INVALID_RESPONSE');
  } finally {
    await reader.cancel().catch(() => {});
  }
}

const providerErrors = new Set(['UNAUTHORIZED','KEY_REVOKED','CLIENT_NOT_APPROVED','CLIENT_SUSPENDED','FORBIDDEN','PRODUCT_NOT_FOUND','PRODUCT_DISABLED','RATE_LIMITED','INTERNAL_ERROR','SYSTEM_DISABLED','VALIDATION_ERROR']);
function safeError(status, body, retryAfter) {
  const error = new SupplierConnectionError(status === 401 || status === 403 ? 'SUPPLIER_AUTH_REJECTED'
    : status === 404 ? 'SUPPLIER_PRODUCT_NOT_FOUND'
    : status === 429 ? 'SUPPLIER_RATE_LIMITED'
    : [500,502,503,504].includes(status) ? 'SUPPLIER_UNAVAILABLE' : 'SUPPLIER_REQUEST_REJECTED',
    status === 429 ? 429 : [500,502,503,504].includes(status) ? 503 : 502, retryAfter);
  error.upstreamStatus = status;
  error.providerCode = providerErrors.has(body?.error?.code) ? body.error.code : null;
  return error;
}
function safeProduct(product) {
  if (!product || typeof product !== 'object' || !['string','number'].includes(typeof product.product_id)) throw new SupplierConnectionError('SUPPLIER_INVALID_RESPONSE');
  const result = {};
  for (const field of ['product_id','type','platform','name','image','created_at']) {
    if (product[field] == null) result[field] = null;
    else if (['string','number'].includes(typeof product[field])) result[field] = product[field];
  }
  for (const field of ['stock','price','web_price','full_price','rate_percent']) result[field] = typeof product[field] === 'number' && Number.isFinite(product[field]) ? product[field] : null;
  for (const field of ['available','denuvo']) result[field] = typeof product[field] === 'boolean' ? product[field] : null;
  result.steam = null;
  if (product.steam && typeof product.steam === 'object' && !Array.isArray(product.steam)) {
    const steam = product.steam;
    result.steam = {};
    for (const field of ['name','description','description_th','updated_at']) if (typeof steam[field] === 'string') result.steam[field] = steam[field];
    for (const field of ['genres','categories','screenshots']) if (Array.isArray(steam[field])) result.steam[field] = steam[field].filter(v=>typeof v==='string');
    if (steam.platforms && typeof steam.platforms === 'object') result.steam.platforms = Object.fromEntries(['windows','mac','linux'].filter(k=>typeof steam.platforms[k]==='boolean').map(k=>[k,steam.platforms[k]]));
    if (steam.pc_requirements && typeof steam.pc_requirements === 'object') result.steam.pc_requirements = Object.fromEntries(['minimum','recommended'].filter(k=>typeof steam.pc_requirements[k]==='string').map(k=>[k,steam.pc_requirements[k]]));
  }
  return result;
}

async function requestSandbox(path, { env = process.env, fetcher = fetch, wait = sleep, timeoutMs = 5000 } = {}, config = sandboxConfig(env), maxBytes = 65536) {
  const { base, key } = config;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let error;
    try {
      const response = await fetcher(`${base}/api/v1${path}`, {
        method: 'GET', redirect: 'error', signal: controller.signal,
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }
      });
      const status = response.status;
      const retryAfter = status === 429 ? retryAfterSeconds(response.headers.get('retry-after')) : 0;
      const envelope = await readEnvelope(response, maxBytes).catch(error=>{if(response.ok)throw error;return null;});
      if (!response.ok || envelope?.success === false) throw safeError(status, envelope, retryAfter);
      if (envelope?.success !== true || !envelope.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) throw new SupplierConnectionError('SUPPLIER_INVALID_RESPONSE');
      return envelope.data;
    } catch (caught) {
      if (controller.signal.aborted) error = new SupplierConnectionError('SUPPLIER_TIMEOUT', 504);
      else error = caught instanceof SupplierConnectionError ? caught : new SupplierConnectionError('SUPPLIER_NETWORK_ERROR', 503);
    } finally {
      clearTimeout(timer);
    }
    const retriable = ['SUPPLIER_NETWORK_ERROR', 'SUPPLIER_UNAVAILABLE', 'SUPPLIER_RATE_LIMITED'].includes(error.code);
    // Never retry sooner than Retry-After. Long delays are returned, not truncated.
    if (!retriable || attempt === 1 || error.retryAfter > 2) throw error;
    await wait(Math.max(error.retryAfter * 1000, 500 * (2 ** attempt)));
  }
}

export function createSandboxClient(options = {}) {
  const query = type => {
    if (!['offline','sandbox'].includes(type)) throw new SupplierConnectionError('SANDBOX_TYPE_REQUIRED',400);
    return `?type=${type}`;
  };
  return Object.freeze({
    async getMe() {
      const data = await requestSandbox('/me', options);
      if (!data.client || typeof data.client !== 'object' || Array.isArray(data.client)) throw new SupplierConnectionError('SUPPLIER_INVALID_RESPONSE');
      return { success:true, supplier:'499k', mode:'sandbox', connected:true };
    },
    async getProducts(type = 'offline') {
      const data = await requestSandbox('/products'+query(type), options);
      if (!Array.isArray(data.products)) throw new SupplierConnectionError('SUPPLIER_INVALID_RESPONSE');
      return { success:true, data:{products:data.products.map(safeProduct),total:data.products.length} };
    },
    async getProduct(productId = '999001', type = 'offline') {
      if (String(productId) !== '999001') throw new SupplierConnectionError('SANDBOX_PRODUCT_REQUIRED',400);
      const data = await requestSandbox('/products/999001'+query(type), options);
      const product = safeProduct(data);
      if (String(product.product_id) !== '999001') throw new SupplierConnectionError('SUPPLIER_INVALID_RESPONSE');
      return { success:true, data:product };
    }
  });
}

export async function testSandboxConnection(options = {}) {
  return createSandboxClient(options).getMe();
}

export async function readSupplierProducts(options = {}) {
  const env=options.env || process.env;
  if(typeof window!=='undefined')throw new SupplierConnectionError('SERVER_ONLY',503);
  const key=env.SUPPLIER_499K_API_KEY || '';
  const match=/^499k_(test|live)_[A-Za-z0-9_-]+$/.exec(key);
  if(!match || env.SUPPLIER_499K_BASE_URL!=='https://store.499k-network.com')throw new SupplierConnectionError('SUPPLIER_CONFIG_REQUIRED',503);
  const mode=match[1]==='test'?'sandbox':'live';
  const config={base:env.SUPPLIER_499K_BASE_URL,key};
  const me=await requestSandbox('/me',options,config);
  if(!me.client || typeof me.client!=='object')throw new SupplierConnectionError('SUPPLIER_INVALID_RESPONSE');
  try {
    const data=await requestSandbox(mode==='sandbox'?'/products':'/products?type=offline&platform=steam',options,config,8*1024*1024);
    if(!Array.isArray(data.products))throw new SupplierConnectionError('SUPPLIER_INVALID_RESPONSE');
    const clean=value=>{
      if(typeof value==='string')return value.split(key).join('[REDACTED]').replace(/499k_(?:test|live)_[A-Za-z0-9_-]+/g,'[REDACTED]');
      if(Array.isArray(value))return value.map(clean);
      if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!/secret|password|credential|token|authorization|api.?key|key_prefix/i.test(k)).map(([k,v])=>[k,clean(v)]));
      return value;
    };
    return {success:true,data:clean(data),diagnostics:{authentication:'PASS',me:'PASS',products:'PASS',productCount:data.products.length,mode}};
  }catch(error){if(error instanceof SupplierConnectionError){error.mePassed=true;error.mode=mode;}throw error;}
}

// PART 4: explicit live-read opt-in. Still no arbitrary URL, POST, or order method.
export async function fetchOfflineCatalog(options = {}) {
  const env = options.env || process.env;
  let config;
  if (env.SUPPLIER_499K_API_MODE === 'sandbox') config = sandboxConfig(env);
  else {
    if (typeof window !== 'undefined') throw new SupplierConnectionError('SERVER_ONLY',503);
    if (env.SUPPLIER_499K_API_MODE !== 'live' || env.SUPPLIER_499K_ALLOW_LIVE_READ !== 'true') throw new SupplierConnectionError('LIVE_READ_NOT_ENABLED',503);
    if (env.SUPPLIER_499K_BASE_URL !== 'https://store.499k-network.com' || !/^499k_live_[A-Za-z0-9_-]+$/.test(env.SUPPLIER_499K_API_KEY || '')) throw new SupplierConnectionError('SUPPLIER_CONFIG_REQUIRED',503);
    config = {base:env.SUPPLIER_499K_BASE_URL,key:env.SUPPLIER_499K_API_KEY};
  }
  const data = await requestSandbox('/products?type=offline', options, config, 8 * 1024 * 1024);
  // The documented endpoint returns a full snapshot. Never silently import a partial one.
  if (!Array.isArray(data.products) || !Number.isInteger(data.total) || data.total !== data.products.length
    || data.has_more === true || data.next_cursor || data.next_page || data.products.length>10000) throw new SupplierConnectionError('CATALOG_INCOMPLETE',502);
  const products = data.products.map(p=>{
    if (p?.type !== 'offline') throw new SupplierConnectionError('CATALOG_TYPE_MISMATCH',502);
    if (!Number.isInteger(p.stock) || p.stock<0 || !Number.isFinite(p.price) || p.price<0
      || !['string','number'].includes(typeof p.product_id) || !String(p.product_id).trim()
      || typeof p.name!=='string' || !p.name.trim()) throw new SupplierConnectionError('CATALOG_ROW_INVALID',502);
    for(const k of ['web_price','full_price','rate_percent']) if(p[k]!=null && (!Number.isFinite(p[k]) || p[k]<0)) throw new SupplierConnectionError('CATALOG_ROW_INVALID',502);
    if (p.denuvo!=null && typeof p.denuvo!=='boolean') throw new SupplierConnectionError('CATALOG_ROW_INVALID',502);
    if (p.steam!=null && (typeof p.steam!=='object' || Array.isArray(p.steam))) throw new SupplierConnectionError('CATALOG_ROW_INVALID',502);
    for(const k of ['platform','image','created_at']) if(p[k]!=null && typeof p[k]!=='string') throw new SupplierConnectionError('CATALOG_ROW_INVALID',502);
    const result=safeProduct(p);
    // Keep provider Steam shapes (including object arrays and HTML requirements),
    // but never persist unexpected credential-bearing fields.
    const clean=(value,depth=0)=>{
      if(depth>20)throw new SupplierConnectionError('CATALOG_ROW_INVALID',502);
      if(Array.isArray(value))return value.map(v=>clean(v,depth+1));
      if(value && typeof value==='object')return Object.fromEntries(Object.entries(value)
        .filter(([k])=>!/secret|password|credential|token|authorization|api.?key/i.test(k))
        .map(([k,v])=>[k,clean(v,depth+1)]));
      return value;
    };
    if(p.steam)result.steam=Object.fromEntries(['name','genres','platforms','categories','screenshots','pc_requirements','description','description_th','updated_at']
      .filter(k=>Object.hasOwn(p.steam,k)).map(k=>[k,clean(p.steam[k])]));
    const encoded=JSON.stringify(result);
    if (encoded.includes(config.key) || /499k_(?:test|live)_|sb_secret_|eyJ[A-Za-z0-9_-]+\.eyJ/.test(encoded)) throw new SupplierConnectionError('CATALOG_SENSITIVE_DATA',502);
    return result;
  });
  return {products,total:data.total};
}
