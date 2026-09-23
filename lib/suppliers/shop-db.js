const BASE='https://wtvfgwacodfrzxapwoxj.supabase.co';
export const uuid=value=>typeof value==='string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
export class ShopError extends Error {
  constructor(code,status=503){super(code);this.code=code;this.status=status;}
}
const dbCodes=['ORDER_NOT_FOUND','IDEMPOTENCY_CONFLICT','SUPPLIER_PRICE_CHANGED','SUPPLIER_OUT_OF_STOCK',
  'SUPPLIER_PRODUCT_UNAVAILABLE','VERIFIED_PAYMENT_REQUIRED','SUPPLIER_MANUAL_REVIEW_REQUIRED',
  'SUPPLIER_FULFILLMENT_BUSY','SUPPLIER_LEASE_MISMATCH','GUARD_BUSY','GUARD_WINDOW_CLOSED','SUPPLIER_RATE_LIMITED'];
export function createShopDb({env=process.env,fetcher=fetch}={}) {
  async function request(path,{method='GET',body,token}={}) {
    if(typeof window!=='undefined' || env.SUPABASE_URL?.replace(/\/$/,'')!==BASE || !env.SUPABASE_SERVICE_ROLE_KEY)throw new ShopError('SERVER_CONFIG_REQUIRED');
    const key=env.SUPABASE_SERVICE_ROLE_KEY;
    let response;
    try {
      response=await fetcher(`${BASE}${path}`,{method,redirect:'error',signal:AbortSignal.timeout(5000),
        headers:{apikey:key,Authorization:`Bearer ${token || key}`,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
        ...(body?{body:JSON.stringify(body)}:{})});
      // PostgREST returns 204 for RETURNS void RPCs (rate limits, Guard finish).
      if(response.status===204)return null;
      const data=await response.json();
      if(!response.ok){const code=dbCodes.find(c=>data?.message===c);const diagnosis={PGRST202:'SUPPLIER_MIGRATION_REQUIRED',PGRST204:'SUPPLIER_MIGRATION_REQUIRED','42883':'SUPPLIER_MIGRATION_REQUIRED','42501':'SUPPLIER_PERMISSION_REQUIRED','23502':'SUPPLIER_SCHEMA_MISMATCH','23514':'SUPPLIER_SCHEMA_MISMATCH'}[data?.code];throw new ShopError(code || diagnosis || 'SUPPLIER_DATABASE_UNAVAILABLE',code==='ORDER_NOT_FOUND'?404:code?409:503);}
      return data;
    }catch(error){if(error instanceof ShopError)throw error;throw new ShopError('SUPPLIER_DATABASE_UNAVAILABLE');}
  }
  return {
    async hide499kProducts(){
      // Fixed target and fields: no caller-controlled table, filter or patch.
      await request('/rest/v1/supplier_products?supplier=eq.499k&is_visible=eq.true&select=id',{
        method:'PATCH',body:{is_visible:false}
      });
      return {hidden:true};
    },
    select:async(table,params)=>{
      if(!['supplier_products','supplier_checkouts','supplier_deliveries','orders','profiles'].includes(table))throw new ShopError('INVALID_DB_TARGET');
      const rows=await request(`/rest/v1/${table}?${new URLSearchParams(params)}`);
      if(!Array.isArray(rows))throw new ShopError('SUPPLIER_DATABASE_UNAVAILABLE');return rows;
    },
    rpc:(name,args)=>{
      if(!['server_create_supplier_checkout','server_claim_supplier_checkout','server_finish_supplier_checkout',
        'server_fail_supplier_checkout','server_supplier_rate_limit','server_supplier_guard_begin','server_begin_supplier_fulfillment',
        'server_supplier_guard_finish','server_publish_499k_storefront','server_supplier_runtime_status',
        'server_supplier_sync_claim','server_supplier_sync_finish','server_supplier_quote','server_create_supplier_checkout_v2'].includes(name))throw new ShopError('INVALID_DB_TARGET');
      return request(`/rest/v1/rpc/${name}`,{method:'POST',body:args});
    },
    async authenticate(req){
      const token=/^Bearer ([^\s]+)$/i.exec(req.headers?.authorization || '')?.[1];
      if(!token)throw new ShopError('AUTH_REQUIRED',401);
      let user;try{user=await request('/auth/v1/user',{token});}catch{throw new ShopError('AUTH_REQUIRED',401);}
      if(!uuid(user?.id))throw new ShopError('AUTH_REQUIRED',401);
      const rows=await request(`/rest/v1/profiles?${new URLSearchParams({select:'id,status',id:`eq.${user.id}`,limit:'1'})}`);
      if(!Array.isArray(rows)||rows.length!==1||rows[0].status!=='active')throw new ShopError('ACTIVE_ACCOUNT_REQUIRED',403);
      return user.id;
    }
  };
}
