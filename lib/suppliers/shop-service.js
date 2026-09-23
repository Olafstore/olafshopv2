import {createShopDb,ShopError,uuid} from './shop-db.js';
import {create499kFulfillmentClient} from './499k/fulfillment-client.js';
import {assertSupplierDeliveryKey,encryptSupplierAccount,decryptSupplierAccount} from './delivery-crypto.js';
import {syncSupplierCatalog} from './catalog-sync.js';
import {getSteamMetadata,supplierSteamId,steamText} from '../steam-metadata.js';
import {fetchOfflineCatalog} from './499k/client.js';

const PUBLIC_PRODUCT_FIELDS='id,supplier_product_id,name,description,image,platform,region,stock,selling_price,full_price,denuvo,steam';
const cleanText=value=>typeof value==='string'?value.replace(/<[^>]*>/g,'').slice(0,16000):'';
const imageURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
export function publicSupplierProduct(row){
  const steamAppId=supplierSteamId(row);
  return {id:row.id,name:cleanText(row.name),description:cleanText(row.steam?.description_th || row.description || row.steam?.description),
    ageStatus:'unknown',ageRestricted:Number(row.steam?.required_age)>=18 || /18\s*\+|🔞|sexual content|nudity|adult only|เนื้อหาทางเพศ|โป๊เปลือย/i.test([row.name,...(Array.isArray(row.steam?.genres)?row.steam.genres:[])].join(' ')),
    image:steamAppId?`https://olafshop.com/api/steam-app?appid=${steamAppId}&image=header`:imageURL(row.image),steamAppId:steamAppId?Number(steamAppId):null,platform:'steam',region:cleanText(row.region),available:row.stock>0,stock:Math.max(0,Number(row.stock)||0),
    price:Number(row.selling_price),compareAt:Number(row.full_price)>Number(row.selling_price)?Number(row.full_price):null,
    denuvo:row.denuvo===true,genres:Array.isArray(row.steam?.genres)?row.steam.genres.filter(v=>typeof v==='string').slice(0,12).map(cleanText):[],
    screenshots:Array.isArray(row.steam?.screenshots)?row.steam.screenshots.slice(0,8).map(imageURL).filter(Boolean):[],
    requirements:steamText(row.steam?.pc_requirements?.minimum),recommendedRequirements:steamText(row.steam?.pc_requirements?.recommended)};
}
const safeOrder=(s,o)=>({id:s.order_id,name:s.product_name,image:imageURL(s.product_image),price:Number(s.selling_price),
  state:s.state,status:o.status,paymentStatus:o.payment_status,orderNumber:o.order_number,paymentMethod:o.payment_method,
  total:Number(o.total),expiresAt:o.expires_at,createdAt:s.created_at,hasSlip:Boolean(o.payment_slip_path),
  needsSupport:s.state==='blocked'||s.state==='uncertain',canReceive:s.state==='delivered'&&o.payment_status==='verified'&&o.status==='delivered'});

export function createSupplierShop({env=process.env,db=createShopDb({env}),client=create499kFulfillmentClient({env}),sync=()=>syncSupplierCatalog({env,db}),steam=getSteamMetadata}={}){
  function ready(){
    if(env.SUPPLIER_499K_LIVE_PURCHASE_ENABLED!=='true')throw new ShopError('LIVE_PURCHASE_DISABLED',503);
    if(!/^499k_live_[A-Za-z0-9_-]+$/.test(env.SUPPLIER_499K_API_KEY?.trim()||'')||env.SUPPLIER_499K_BASE_URL!=='https://store.499k-network.com')throw new ShopError('SERVER_CONFIG_REQUIRED');
    assertSupplierDeliveryKey(env);
  }
  async function owned(orderId,userId){
    if(!uuid(orderId)||!uuid(userId))throw new ShopError('ORDER_NOT_FOUND',404);
    const [s]=await db.select('supplier_checkouts',{select:'*',order_id:`eq.${orderId}`,user_id:`eq.${userId}`,limit:'1'});
    if(!s || s.user_id!==userId || s.order_id!==orderId)throw new ShopError('ORDER_NOT_FOUND',404);
    const [o]=await db.select('orders',{select:'id,user_id,order_number,status,payment_status,total,expires_at,payment_method,payment_slip_path',id:`eq.${orderId}`,user_id:`eq.${userId}`,limit:'1'});
    if(!o || o.user_id!==userId)throw new ShopError('ORDER_NOT_FOUND',404);
    return {s,o};
  }
  async function limit(bucket){await db.rpc('server_supplier_rate_limit',{p_bucket:bucket});}
  return {
    ready,
    async diagnose(){
      // Admin-only read diagnostics. Never create orders, reserve funds or reveal payloads.
      const checks={revision:'supplier-auth-v5',authMode:env.SUPPLIER_499K_AUTH_MODE==='bearer'?'bearer':'x-api-key'};
      const check=async(name,operation)=>{try{await operation();checks[name]={ok:true};}catch(e){checks[name]={ok:false,code:/^[A-Z_]+$/.test(e.code||'')?e.code:'READ_FAILED',...(e.diagnostics?{diagnostics:e.diagnostics}:{})};}};
      await check('configuration',async()=>ready());
      if(!checks.configuration.ok)return checks;
      await check('account',()=>client.getMe());
      if(!checks.account.ok)return checks;
      let catalog;
      await check('catalog',async()=>{catalog=await fetchOfflineCatalog({env:{...env,SUPPLIER_499K_API_MODE:'live',SUPPLIER_499K_ALLOW_LIVE_READ:'true'}});});
      if(!checks.catalog.ok)return checks;
      checks.productCount=catalog.total;
      const samples=catalog.products.filter(p=>p.platform==='steam'&&p.stock>0&&p.price>0).slice(0,2);
      checks.sampleCount=samples.length;
      for(const [index,p] of samples.entries())await check(`productSample${index+1}`,()=>client.getProduct(String(p.product_id)));
      return checks;
    },
    async product(productId){
      if(!uuid(productId))throw new ShopError('SUPPLIER_PRODUCT_UNAVAILABLE',404);
      const [row]=await db.select('supplier_products',{select:PUBLIC_PRODUCT_FIELDS,id:`eq.${productId}`,supplier:'eq.499k',product_type:'eq.offline',platform:'eq.steam',status:'eq.active',is_visible:'eq.true',selling_price:'gt.0',limit:'1'});
      if(!row)throw new ShopError('SUPPLIER_PRODUCT_UNAVAILABLE',404);
      const result=publicSupplierProduct(row);
      if(result.steamAppId){try{const s=await steam(result.steamAppId);return {...result,ageStatus:s.ageStatus||'unknown',ageRestricted:result.ageRestricted||s.ageRestricted===true,image:s.headerImage||result.image,screenshots:s.screenshots,description:s.description||result.description,shortDescription:s.shortDescription,requirements:s.requirements.minimum.join('\n'),recommendedRequirements:s.requirements.recommended.join('\n'),genres:s.genres,steamUrl:s.steamUrl,steamMetadataStatus:'ready'};}catch{return {...result,steamMetadataStatus:'unavailable'};}}
      return {...result,steamMetadataStatus:'unmapped'};
    },
    async readiness(){
      let deliveryKeyReady=true;try{assertSupplierDeliveryKey(env);}catch{deliveryKeyReady=false;}
      const database=await db.rpc('server_supplier_runtime_status',{});
      return {database,deliveryKeyReady,purchaseEnabled:env.SUPPLIER_499K_LIVE_PURCHASE_ENABLED==='true',
        liveKeyReady:/^499k_live_[A-Za-z0-9_-]+$/.test(env.SUPPLIER_499K_API_KEY?.trim()||'')&&env.SUPPLIER_499K_BASE_URL==='https://store.499k-network.com'};
    },
    async catalog(){
      let checkoutEnabled=true;try{ready();}catch{checkoutEnabled=false;}
      let fresh=false;try{fresh=(await sync()).fresh;}catch{/* Keep last-known catalog readable, but fail closed for new purchases. */}
      const rows=await db.select('supplier_products',{select:PUBLIC_PRODUCT_FIELDS,supplier:'eq.499k',product_type:'eq.offline',platform:'eq.steam',is_visible:'eq.true',status:'eq.active',selling_price:'gt.0',order:'name.asc',limit:'1000'});
      // Lists need only card fields. Full descriptions, requirements and galleries
      // are fetched via the individual product endpoint, not sent for every game.
      return {checkoutEnabled:checkoutEnabled&&fresh,pricesFresh:fresh,products:rows.map(row=>{
        const {description,screenshots,requirements,recommendedRequirements,...card}=publicSupplierProduct(row);
        return card;
      })};
    },
    async quote(userId,productId){
      ready();if(!uuid(productId))throw new ShopError('INVALID_CHECKOUT',400);
      const [p]=await db.select('supplier_products',{select:'supplier_product_id',id:`eq.${productId}`,supplier:'eq.499k',product_type:'eq.offline',platform:'eq.steam',status:'eq.active',is_visible:'eq.true',limit:'1'});
      if(!p)throw new ShopError('SUPPLIER_PRODUCT_UNAVAILABLE',404);
      await limit(`checkout:${userId}`);await limit('supplier-read');
      const q=await client.getProduct(p.supplier_product_id);
      return db.rpc('server_supplier_quote',{p_product_id:productId,p_cost:q.price,p_stock:q.available?q.stock:0});
    },
    async checkout(userId,{productId,requestId,paymentMethod,expectedPrice}){
      ready();
      if(!uuid(productId)||!uuid(requestId)||!['promptpay','wallet'].includes(paymentMethod))throw new ShopError('INVALID_CHECKOUT',400);
      // Resolve idempotent replay before fetching a stock quote that may have changed.
      const [prior]=await db.select('supplier_checkouts',{select:'order_id,product_id',user_id:`eq.${userId}`,request_id:`eq.${requestId}`,limit:'1'});
      if(prior){const {s,o}=await owned(prior.order_id,userId);if(s.product_id!==productId||o.payment_method!==paymentMethod)throw new ShopError('IDEMPOTENCY_CONFLICT',409);return safeOrder(s,o);}
      const [p]=await db.select('supplier_products',{select:'id,supplier_product_id',id:`eq.${productId}`,supplier:'eq.499k',product_type:'eq.offline',platform:'eq.steam',status:'eq.active',is_visible:'eq.true',limit:'1'});
      if(!p)throw new ShopError('SUPPLIER_PRODUCT_UNAVAILABLE',404);
      await limit(`checkout:${userId}`);
      await limit('supplier-read');
      const quote=await client.getProduct(p.supplier_product_id);
      if(!quote.available)throw new ShopError('SUPPLIER_OUT_OF_STOCK',409);
      await db.rpc('server_supplier_quote',{p_product_id:productId,p_cost:quote.price,p_stock:quote.stock});
      const result=await db.rpc('server_create_supplier_checkout_v2',{p_user_id:userId,p_product_id:productId,p_request_id:requestId,
        p_quote_cost:quote.price,p_quote_stock:quote.stock,p_payment_method:paymentMethod,p_expected_price:expectedPrice});
      const {s,o}=await owned(result.order.id,userId);return safeOrder(s,o);
    },
    async orders(userId){
      const rows=await db.select('supplier_checkouts',{select:'*',user_id:`eq.${userId}`,order:'created_at.desc',limit:'100'});
      if(!rows.length)return [];
      const orders=await db.select('orders',{select:'id,user_id,order_number,status,payment_status,total,expires_at,payment_method,payment_slip_path',id:`in.(${rows.map(r=>r.order_id).join(',')})`,user_id:`eq.${userId}`,limit:'100'});
      const map=new Map(orders.map(o=>[o.id,o]));return rows.filter(r=>map.has(r.order_id)).map(r=>safeOrder(r,map.get(r.order_id)));
    },
    async order(userId,orderId){const {s,o}=await owned(orderId,userId);return safeOrder(s,o);},
    async fulfill(userId,orderId){
      ready();await owned(orderId,userId);
      const claim=await db.rpc('server_begin_supplier_fulfillment',{p_order_id:orderId,p_user_id:userId});
      if(claim.alreadyDelivered)return {state:'delivered'};
      const s=claim.checkout;
      if(s?.order_id!==orderId||s?.user_id!==userId||s?.supplier!=='499k'||s?.product_type!=='offline'||s?.platform!=='steam'||s?.supplier_ref!==`olaf499-${orderId}`)throw new ShopError('INVALID_SUPPLIER_CLAIM');
      try{
        const receipt=await client.purchase({productId:s.supplier_product_id,reference:s.supplier_ref,maximumCost:s.quoted_cost,recovery:claim.recovery===true});
        const encrypted=encryptSupplierAccount(orderId,receipt.account,env);
        await db.rpc('server_finish_supplier_checkout',{p_order_id:orderId,p_lease_token:s.lease_token,
          p_provider_order_no:receipt.order_no,p_actual_cost:receipt.price,p_ciphertext:encrypted.ciphertext,p_key_version:encrypted.key_version});
        return {state:'delivered'};
      }catch(error){
        const mapping={OUT_OF_STOCK:'SUPPLIER_OUT_OF_STOCK',SUPPLIER_PRICE_CHANGED:'SUPPLIER_PRICE_CHANGED',INSUFFICIENT_BALANCE:'SUPPLIER_INSUFFICIENT_BALANCE',
          UNAUTHORIZED:'SUPPLIER_AUTH_REJECTED',KEY_REVOKED:'SUPPLIER_AUTH_REJECTED',CLIENT_SUSPENDED:'SUPPLIER_AUTH_REJECTED'};
        const code=mapping[error?.code] || 'SUPPLIER_RESULT_UNKNOWN';
        const uncertain=error?.uncertain===true || !mapping[error?.code];
        await db.rpc('server_fail_supplier_checkout',{p_order_id:orderId,p_lease_token:s.lease_token,p_code:code,p_uncertain:uncertain}).catch(()=>{});
        // Payment remains successful; never return account data, raw errors or supplier balance here.
        return {state:uncertain?'uncertain':'blocked',needsSupport:true};
      }
    },
    async delivery(userId,orderId){
      const {s,o}=await owned(orderId,userId);
      if(s.state!=='delivered'||o.status!=='delivered'||o.payment_status!=='verified')throw new ShopError('DELIVERY_NOT_READY',409);
      const [d]=await db.select('supplier_deliveries',{select:'ciphertext,key_version',order_id:`eq.${orderId}`,limit:'1'});
      if(!d||d.key_version!=='v1')throw new ShopError('DELIVERY_NOT_READY',409);
      return decryptSupplierAccount(orderId,d.ciphertext,env);
    },
    async guard(userId,orderId,{reason}={}){
      ready();const {s,o}=await owned(orderId,userId);
      if(s.state!=='delivered'||o.status!=='delivered'||o.payment_status!=='verified')throw new ShopError('DELIVERY_NOT_READY',409);
      if(reason!==undefined&&(typeof reason!=='string'||[...reason.trim()].length<5||[...reason.trim()].length>500))throw new ShopError('INVALID_GUARD_REASON',400);
      await limit('supplier-read');
      const lease=await db.rpc('server_supplier_guard_begin',{p_order_id:orderId,p_user_id:userId,p_new_round:reason!==undefined});
      try{
        const result=await client.steamGuard({providerOrderNo:s.provider_order_no,reason});
        await db.rpc('server_supplier_guard_finish',{p_order_id:orderId,p_token:lease.token,p_window_seconds:result.window.expires_in_sec});
        return result;
      }catch(error){
        await db.rpc('server_supplier_guard_finish',{p_order_id:orderId,p_token:lease.token,p_window_seconds:null}).catch(()=>{});
        throw error;
      }
    },
    // Hiding must work even if the provider is down or live purchasing is disabled.
    async hide(){return db.hide499kProducts();},
    async publish(){ready();return db.rpc('server_publish_499k_storefront',{});}
  };
}

// Called only after the existing payment RPC has committed. Never undo payment on supplier failure.
export async function fulfillSupplierAfterPayment(order,userId,options={}){
  if(!order?.order_number?.startsWith('S499-'))return null;
  try{return await createSupplierShop(options).fulfill(userId,order.id);}
  catch{return {state:'pending',needsSupport:true};}
}
