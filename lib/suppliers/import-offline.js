import { fetchOfflineCatalog, SupplierConnectionError, supplierKey } from './499k/client.js';

export async function importOfflineCatalog({env=process.env,fetcher=fetch,wait}={}) {
  if (typeof window !== 'undefined') throw new SupplierConnectionError('SERVER_ONLY',503);
  if (env.SUPPLIER_499K_IMPORT_ENABLED!=='true') throw new SupplierConnectionError('IMPORT_DISABLED',503);
  const base=env.SUPABASE_URL?.replace(/\/$/,'');
  const key=env.SUPABASE_SERVICE_ROLE_KEY;
  if (base!=='https://wtvfgwacodfrzxapwoxj.supabase.co' || !key) throw new SupplierConnectionError('SERVER_CONFIG_REQUIRED',503);
  // Import enablement is explicit; select live mode from the key, as with reads.
  // Sandbox products must never be mislabeled/imported as real offline stock.
  const apiKey=supplierKey(env);
  if(!apiKey)throw new SupplierConnectionError('SUPPLIER_API_KEY_MISSING',503);
  if(/^499k_test_[A-Za-z0-9_-]+$/.test(apiKey))throw new SupplierConnectionError('SANDBOX_KEY_CANNOT_IMPORT_OFFLINE',503);
  if(!/^499k_live_[A-Za-z0-9_-]+$/.test(apiKey))throw new SupplierConnectionError('SUPPLIER_API_KEY_FORMAT_INVALID',503);
  const catalog=await fetchOfflineCatalog({env:{...env,SUPPLIER_499K_API_MODE:'live',SUPPLIER_499K_ALLOW_LIVE_READ:'true'},fetcher,wait});
  const unique=new Map();
  let duplicates=0;
  const rows=catalog.products.map(p=>({supplier:'499k',supplier_product_id:String(p.product_id),product_type:'offline',
    platform:p.platform,name:p.name,image:p.image,stock:p.stock,price:p.price,web_price:p.web_price,full_price:p.full_price,
    rate_percent:p.rate_percent,created_at:p.created_at,denuvo:p.denuvo,steam:p.steam}));
  for(const row of rows){
    const existing=unique.get(row.supplier_product_id);
    if(existing){
      if(JSON.stringify(existing)!==JSON.stringify(row))throw new SupplierConnectionError('CATALOG_DUPLICATE_CONFLICT',502);
      duplicates++;
    } else unique.set(row.supplier_product_id,row);
  }
  if(!rows.length)return {fetched:0,inserted:0,updated:0,duplicatesPrevented:0,errors:0};
  // Database RPC is atomic. Never retry an uncertain database commit automatically.
  let response, result;
  try {
    response=await fetcher(`${base}/rest/v1/rpc/server_import_499k_offline`,{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
      headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({p_products:[...unique.values()]})
    });
    if(!response.ok) throw new SupplierConnectionError('DATABASE_IMPORT_REJECTED',502);
    result=await response.json();
  } catch(error){
    if(error instanceof SupplierConnectionError)throw error;
    throw new SupplierConnectionError('DATABASE_IMPORT_RESULT_UNKNOWN',503);
  }
  if(!result || !['inserted','updated','duplicatesPrevented','errors'].every(k=>Number.isInteger(result[k])&&result[k]>=0)
    || result.inserted+result.updated!==unique.size)throw new SupplierConnectionError('DATABASE_IMPORT_RESULT_UNKNOWN',503);
  return {fetched:catalog.total,inserted:result.inserted,updated:result.updated,duplicatesPrevented:duplicates+result.duplicatesPrevented,errors:result.errors};
}
