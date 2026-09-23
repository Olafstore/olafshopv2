// Internal server transport only. Not a public HTTP handler or authorization layer.
// A caller MUST claim a paid, owned checkout via server_claim_supplier_checkout first.
// Route authorization and durable payment/ownership claims live in shop-service.js.
import {supplierKey, supplierHeaders, retryAfterSeconds} from './client.js';

const knownErrors = new Set(['UNAUTHORIZED','KEY_REVOKED','CLIENT_NOT_APPROVED','CLIENT_SUSPENDED',
  'MIN_TOPUP_REQUIRED','FORBIDDEN','SYSTEM_DISABLED','VALIDATION_ERROR','PRODUCT_NOT_FOUND',
  'PRODUCT_DISABLED','OUT_OF_STOCK','INSUFFICIENT_BALANCE','CODE_LIMIT_REACHED','CODE_UNAVAILABLE',
  'ORDER_REFUNDED','NOT_FOUND','RATE_LIMITED','INTERNAL_ERROR']);

export class SupplierFulfillmentError extends Error {
  constructor(code, {uncertain=false, retryAfter=0}={}) {
    super(code);
    this.code=code;
    this.uncertain=uncertain;
    this.retryAfter=retryAfter;
  }
}
const fail = (code, options) => {throw new SupplierFulfillmentError(code, options);};
const productId = value => typeof value === 'string' && /^[0-9]{1,20}$/.test(value) && value !== '999001';
const orderNo = value => typeof value === 'string' && /^API-[A-Za-z0-9-]{1,80}$/.test(value);
const money = value => {
  const str=String(value);
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(str)) fail('INVALID_SUPPLIER_PRICE');
  const [whole,fraction='']=str.split('.');
  return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
};

export function create499kFulfillmentClient({env=process.env, fetcher=fetch, timeoutMs=8000}={}) {
  function config() {
    const key=supplierKey(env);
    if (env.SUPPLIER_499K_LIVE_PURCHASE_ENABLED !== 'true') fail('LIVE_PURCHASE_DISABLED');
    if (!/^499k_live_[A-Za-z0-9_-]+$/.test(key)) fail('LIVE_KEY_REQUIRED');
    if (env.SUPPLIER_499K_BASE_URL !== 'https://store.499k-network.com') fail('SUPPLIER_CONFIG_REQUIRED');
    return {key,base:env.SUPPLIER_499K_BASE_URL};
  }
  async function request(path, body) {
    const {key,base}=config();
    const isPost=body !== undefined;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    let upstreamStatus=null,responseFormat='other',reason=null;
    const maxBytes=isPost?524288:path.startsWith('/products?')?8*1024*1024:2*1024*1024;
    try {
      const response=await fetcher(`${base}/api/v1${path}`, {
        method:isPost?'POST':'GET', redirect:'error', signal:controller.signal,
        headers:{...supplierHeaders(env), ...(isPost?{'Content-Type':'application/json'}:{})},
        ...(isPost?{body:JSON.stringify(body)}:{})
      });
      upstreamStatus=response.status;
      const reader=response.body?.getReader?.();
      const iterator=reader?null:response.body?.[Symbol.asyncIterator]?.();
      if (!reader&&!iterator) {reason='missing_body';fail('SUPPLIER_INVALID_RESPONSE',{uncertain:isPost});}
      let size=0; const chunks=[];
      try {
        while(true) {
          const {done,value}=reader?await reader.read():await iterator.next(); if(done) break;
          const chunk=Buffer.from(value);size+=chunk.byteLength;
          if(size>maxBytes) {reason='body_too_large';fail('SUPPLIER_INVALID_RESPONSE',{uncertain:isPost});}
          chunks.push(chunk);
        }
      } finally {if(reader)await reader.cancel().catch(()=>{});else await iterator.return?.().catch(()=>{});}
      let envelope;
      const raw=Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/,'').trim();
      responseFormat=/^\s*</.test(raw)?'html':'other';
      try { envelope=JSON.parse(raw);responseFormat='json'; }
      catch {reason='invalid_json';fail(response.status===403?'SUPPLIER_UPSTREAM_BLOCKED':'SUPPLIER_INVALID_RESPONSE',{uncertain:isPost});}
      if(!response.ok || envelope?.success !== true) {
        const code=knownErrors.has(envelope?.error?.code)?envelope.error.code:'SUPPLIER_REQUEST_FAILED';
        fail(code,{uncertain:isPost && (response.status>=500 || code==='SUPPLIER_REQUEST_FAILED'),
          retryAfter:response.status===429?retryAfterSeconds(response.headers.get('retry-after')):0});
      }
      if(!envelope.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) {reason='data_shape';fail('SUPPLIER_INVALID_RESPONSE',{uncertain:isPost});}
      return envelope.data;
    } catch(error) {
      if(error instanceof SupplierFulfillmentError){error.diagnostics={revision:'supplier-response-v3',stage:path.startsWith('/products')?'product':isPost?'purchase_or_guard':'order',upstreamStatus,responseFormat,reason};throw error;}
      fail('SUPPLIER_REQUEST_FAILED',{uncertain:isPost});
    } finally { clearTimeout(timer); }
  }
  async function getProduct(id) {
    if(!productId(id)) fail('INVALID_SUPPLIER_PRODUCT');
    let data;
    try{data=await request(`/products/${id}?type=offline`);}catch(error){
      // Only recover an unreadable successful GET through the official fresh catalog.
      // Never bypass 401/403/404/429, or retry any purchase/Guard POST.
      if(error.code!=='SUPPLIER_INVALID_RESPONSE'||error.diagnostics?.upstreamStatus!==200)throw error;
      const list=await request('/products?type=offline&platform=steam');
      const row=Array.isArray(list.products)?list.products.find(p=>String(p.product_id)===id):null;
      if(!row)throw error;
      data={...row,available:typeof row.available==='boolean'?row.available:Number.isSafeInteger(row.stock)&&row.stock>0};
    }
    if(String(data.product_id)!==id || data.type!=='offline' || data.platform!=='steam'
      || !Number.isSafeInteger(data.stock) || data.stock<0 || typeof data.available!=='boolean'
      || money(data.price)<=0n) fail('SUPPLIER_PRODUCT_MISMATCH');
    return {product_id:id, price:data.price, stock:data.stock, available:data.available};
  }
  return Object.freeze({
    async getMe() {
      const data=await request('/me');
      if(data.client?.status!=='approved') fail('CLIENT_NOT_APPROVED');
      if(data.min_topup?.passed!==true) fail('MIN_TOPUP_REQUIRED');
      // Do not expose balances, identity, key_prefix or raw upstream data.
      return {approved:true,minimumTopupPassed:true};
    },
    getProduct,
    async purchase({productId:id,reference,maximumCost,recovery=false}) {
      if(!productId(id) || !/^olaf499-[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(reference || '')
        || typeof recovery!=='boolean' || money(maximumCost)<=0n) fail('INVALID_SUPPLIER_PURCHASE');
      if(!recovery) {
        const product=await getProduct(id);
        if(!product.available || product.stock<1) fail('OUT_OF_STOCK');
        if(money(product.price)>money(maximumCost)) fail('SUPPLIER_PRICE_CHANGED');
      }
      // No automatic POST retry. Recovery must use the persisted, identical ref.
      // The API has no price-lock parameter: record actual_cost and flag slippage.
      let data;
      if(recovery){
        // Resolve uncertain outcomes with read-only reconciliation. Do not bypass the
        // price check by sending a new POST when an earlier attempt may never have sent one.
        const history=await request('/orders?page=1&limit=100');
        const match=Array.isArray(history.orders)?history.orders.find(row=>row.ref===reference):null;
        if(!match || !orderNo(match.order_no))fail('SUPPLIER_RECONCILIATION_REQUIRED',{uncertain:true});
        data=await request(`/orders/${match.order_no}`);
      }else{
        data=await request('/orders',{product_id:id,type:'offline',ref:reference});
      }
      try {
        if(!orderNo(data.order_no) || String(data.product_id)!==id || data.type!=='offline'
          || data.platform!=='steam' || data.ref!==reference || (data.status && data.status!=='success')
          || money(data.price)<=0n || !['username','password'].every(k =>
            typeof data.account?.[k]==='string' && data.account[k].length>0 && data.account[k].length<=4096)) throw new Error();
      } catch { fail('SUPPLIER_RECEIPT_MISMATCH',{uncertain:true}); }
      return {order_no:data.order_no,ref:reference,product_id:id,price:data.price,
        account:{username:data.account.username,password:data.account.password},idempotent:data.idempotent===true};
    },
    async steamGuard({providerOrderNo,reason}) {
      if(!orderNo(providerOrderNo)) fail('INVALID_SUPPLIER_ORDER');
      if(reason!==undefined && (typeof reason!=='string' || [...reason.trim()].length<5 || [...reason.trim()].length>500)) fail('INVALID_GUARD_REASON');
      // No auto retry: a repeated POST after a timeout could consume another round.
      const data=await request(`/orders/${providerOrderNo}/code`,reason===undefined?{}:{reason:reason.trim()});
      if(typeof data.code!=='string' || !/^[A-Z0-9]{5}$/.test(data.code)
        || !Number.isInteger(data.valid_for_sec) || data.valid_for_sec<0 || data.valid_for_sec>30
        || !Number.isInteger(data.window?.expires_in_sec) || data.window.expires_in_sec<0 || data.window.expires_in_sec>60
        || typeof data.window.new_round!=='boolean' || data.code_requests?.max!==3
        || !Number.isInteger(data.code_requests.used) || data.code_requests.used<0 || data.code_requests.used>3) fail('SUPPLIER_INVALID_RESPONSE',{uncertain:true});
      return {code:data.code,valid_for_sec:data.valid_for_sec,
        window:{expires_in_sec:data.window.expires_in_sec,new_round:data.window.new_round},
        code_requests:{used:data.code_requests.used,max:3}};
    }
  });
}
