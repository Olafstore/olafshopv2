import {fetchOfflineCatalog} from './499k/client.js';
// Durable lease across serverless instances. No purchases and no legacy writes.
export async function syncSupplierCatalog({env,db,fetcher=fetch}) {
  const claim=await db.rpc('server_supplier_sync_claim',{});
  if(!claim?.token)return {fresh:claim?.fresh===true};
  try {
    const catalog=await fetchOfflineCatalog({env:{...env,SUPPLIER_499K_API_MODE:'live',SUPPLIER_499K_ALLOW_LIVE_READ:'true'},fetcher});
    const rows=catalog.products.filter(p=>p.platform==='steam').map(p=>({supplier_product_id:String(p.product_id),price:p.price,web_price:p.web_price,full_price:p.full_price,stock:p.stock,rate_percent:p.rate_percent}));
    await db.rpc('server_supplier_sync_finish',{p_token:claim.token,p_products:rows});
    return {fresh:true};
  } catch(error) {
    await db.rpc('server_supplier_sync_finish',{p_token:claim.token,p_products:null}).catch(()=>{});
    throw error;
  }
}
