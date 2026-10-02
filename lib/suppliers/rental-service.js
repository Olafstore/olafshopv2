import {createShopDb,ShopError,uuid} from './shop-db.js';
import {readRentalProducts,readRentalAvailability} from './499k/client.js';
import {createRentalClient} from './499k/rental-client.js';
import {priceAt50PercentMarkup} from './pricing.js';
import {rentalCatalogMedia,rentalProductMedia} from './rental-media.js';

const halfHour=1800000,day=86400000;
const numericId=id=>/^[1-9][0-9]{0,15}$/.test(String(id||''));
// Rental only: retain the existing markup, then add THB 20 per purchased package.
const selling=cost=>Math.round((Number(priceAt50PercentMarkup(cost).selling_price)+20)*100)/100;
export function rentalQuote(availability,{startAt,durationDays,accountId},now=Date.now()) {
  const start=Date.parse(startAt),days=durationDays;
  if(typeof startAt!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(startAt)||!Number.isFinite(start)||start%halfHour!==0
    ||start<Math.floor(now/halfHour)*halfHour||start>now+7*day||start<Date.parse(availability.bookable_from)||start>Date.parse(availability.bookable_until))throw new ShopError('INVALID_START_AT',400);
  if(!Number.isSafeInteger(days)||days<1)throw new ShopError('DURATION_UNAVAILABLE',400);
  const end=start+days*day;
  const options=availability.accounts.filter(a=>accountId==null||a.account_id===accountId)
    .filter(a=>a.rates[String(days)]?.price>0 && !a.busy.some(b=>start<Date.parse(b.to)&&end>Date.parse(b.from)))
    .sort((a,b)=>a.rates[String(days)].price-b.rates[String(days)].price||a.account_id-b.account_id);
  if(!options.length)throw new ShopError('SLOT_UNAVAILABLE',409);
  const account=options[0],cost=account.rates[String(days)].price;
  return {productId:availability.product_id,name:availability.name,kind:'booking',accountId:account.account_id,
    durationDays:days,startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString(),cost,price:selling(cost),parentOrderId:null};
}
export function createRentalShop({env=process.env,fetcher=fetch,db=createShopDb({env,fetcher}),client=createRentalClient({env,fetcher}),
  list=()=>readRentalProducts({env,fetcher}),availability=id=>readRentalAvailability(id,{env,fetcher}),media=rentalCatalogMedia,productMedia=id=>rentalProductMedia(id,{fetcher}),now=()=>Date.now()}={}) {
  let cached=null,cacheTime=0,loading=null;
  function enabled(){if(env.SUPPLIER_499K_RENTAL_ENABLED!=='true'||env.SUPPLIER_499K_LIVE_PURCHASE_ENABLED!=='true'
    ||!/^499k_live_[A-Za-z0-9_-]+$/.test(env.SUPPLIER_499K_API_KEY?.trim()||''))throw new ShopError('RENTAL_DISABLED',503);}
  const limit=bucket=>db.rpc(bucket.startsWith('rental-')?'server_rental_rate_limit':'server_supplier_rate_limit',{p_bucket:bucket});
  async function owned(userId,orderId){
    if(!uuid(orderId)||!uuid(userId))throw new ShopError('ORDER_NOT_FOUND',404);
    const [r]=await db.select('rental_orders',{select:'*',order_id:`eq.${orderId}`,user_id:`eq.${userId}`,limit:'1'});
    const [o]=await db.select('orders',{select:'id,user_id,status,payment_status,total,points_redeemed_amount,order_number,payment_method,expires_at,payment_slip_path',id:`eq.${orderId}`,user_id:`eq.${userId}`,limit:'1'});
    if(!r||!o||r.user_id!==userId||o.user_id!==userId)throw new ShopError('ORDER_NOT_FOUND',404);
    return {r,o};
  }
  function publicOrder({r,o}){return {id:r.order_id,name:r.product_name,productId:r.product_id,kind:r.kind,parentOrderId:r.parent_order_id,
    startAt:r.start_at,endAt:r.end_at,durationDays:r.duration_days,state:r.state,status:o.status,paymentStatus:o.payment_status,
    total:Number(o.total),pointsUsed:Number(o.points_redeemed_amount||0),orderNumber:o.order_number,paymentMethod:o.payment_method,expiresAt:o.expires_at,hasSlip:Boolean(o.payment_slip_path),
    needsSupport:['blocked','uncertain','submitting'].includes(r.state),errorCode:r.error_code,
    canPlay:r.kind==='booking'&&r.state==='reserved'&&o.payment_status==='verified'&&o.status==='delivered'&&now()>=Date.parse(r.start_at)&&now()<Date.parse(r.end_at)};}
  async function quote(userId,input){
    enabled();await limit(`rental-quote:${userId}`);await limit('supplier-read');
    if(input.parentOrderId){
      const {r}=await active(userId,input.parentOrderId);
      const data=(await availability(r.product_id)).data;
      const cost=data.accounts.find(a=>a.account_id===r.account_ref)?.rates[String(input.durationDays)]?.price;
      if(!Number.isSafeInteger(input.durationDays)||input.durationDays<1||!(cost>0))throw new ShopError('DURATION_UNAVAILABLE',409);
      return {productId:r.product_id,name:r.product_name,kind:'renewal',parentOrderId:r.order_id,accountId:r.account_ref,
        durationDays:input.durationDays,startAt:r.end_at,endAt:new Date(Date.parse(r.end_at)+input.durationDays*day).toISOString(),cost,price:selling(cost)};
    }
    if(!numericId(input.productId))throw new ShopError('INVALID_CHECKOUT',400);
    return rentalQuote((await availability(input.productId)).data,input,now());
  }
  async function active(userId,orderId){
    const result=await owned(userId,orderId);
    if(!publicOrder(result).canPlay)throw new ShopError(now()<Date.parse(result.r.start_at)?'RENTAL_NOT_STARTED':'RENTAL_NOT_ACTIVE',403);
    await limit(`rental-access:${userId}`);await limit('supplier-read');
    // Recheck upstream on each credential/code access. Refunded/expired rentals must never use cached secrets.
    const provider=await client.order(result.r.provider_order_no);
    if(provider.type!=='rental'||provider.order_no!==result.r.provider_order_no||String(provider.product_id)!==result.r.product_id
      ||['refunded','expired','cancelled'].includes(provider.status)||['expired','cancelled','refunded'].includes(provider.rental_status)
      ||!Number.isFinite(Date.parse(provider.start_at))||!Number.isFinite(Date.parse(provider.end_at))
      ||now()<Date.parse(provider.start_at)||now()>=Date.parse(provider.end_at))throw new ShopError('RENTAL_NOT_ACTIVE',403);
    return {...result,provider};
  }
  return {
    async catalog(){enabled();if(cached&&now()-cacheTime<10*60000)return cached;
      if(loading)return loading;
      loading=(async()=>{await limit('supplier-read');const response=await list();
        cached={products:await media(response.data.products)};cacheTime=now();return cached;})();
      try{return await loading;}finally{loading=null;}
    },
    async product(id){enabled();if(!numericId(id))throw new ShopError('ORDER_NOT_FOUND',404);
      const catalog=await this.catalog();const row=catalog.products.find(p=>p.id===String(id));if(!row)throw new ShopError('ORDER_NOT_FOUND',404);
      const details=await productMedia(row.steamAppId);if(!details)throw new ShopError('ORDER_NOT_FOUND',404);
      return {...row,...details};
    },
    async availability(userId,id){enabled();if(!numericId(id))throw new ShopError('INVALID_CHECKOUT',400);
      await limit(`rental-quote:${userId}`);await limit('supplier-read');const d=(await availability(id)).data;
      return {...d,accounts:d.accounts.map(a=>({account_id:a.account_id,busy:a.busy,rates:Object.fromEntries(Object.entries(a.rates)
        .filter(([,v])=>v.price>0).map(([days,v])=>[days,{price:selling(v.price)}]))}))};
    },
    async quote(userId,input){const {cost,...q}=await quote(userId,input);return q;},
    async checkout(userId,input){
      enabled();if(!uuid(input.requestId)||!['promptpay','wallet'].includes(input.paymentMethod))throw new ShopError('INVALID_CHECKOUT',400);
      const points=input.pointsToUse??0;
      if(typeof points!=='number'||!Number.isFinite(points)||points<0||Math.round(points*100)/100!==points||points>input.expectedPrice)throw new ShopError('INVALID_CHECKOUT',400);
      const [prior]=await db.select('rental_orders',{select:'*',user_id:`eq.${userId}`,request_id:`eq.${input.requestId}`,limit:'1'});
      if(prior){const existing=await owned(userId,prior.order_id);
        if(prior.product_id!==String(input.productId)||prior.duration_days!==input.durationDays||Date.parse(prior.start_at)!==Date.parse(input.startAt)
          ||prior.account_ref!==input.accountId|| (prior.parent_order_id||null)!==(input.parentOrderId||null)
          ||existing.o.payment_method!==input.paymentMethod||Number(existing.o.points_redeemed_amount||0)!==points||Math.round((Number(existing.o.total)+points)*100)/100!==input.expectedPrice)throw new ShopError('IDEMPOTENCY_CONFLICT',409);
        return publicOrder(existing);
      }
      const q=await quote(userId,input);
      if(typeof input.expectedPrice!=='number'||input.expectedPrice!==q.price||q.accountId!==input.accountId
        ||Date.parse(q.startAt)!==Date.parse(input.startAt))throw new ShopError('SUPPLIER_PRICE_CHANGED',409);
      let result;try{result=await db.rpc(points>0?'server_rental_create_v78':'server_rental_create',{p_user_id:userId,p_request_id:input.requestId,p_data:{...q,paymentMethod:input.paymentMethod,pointsToUse:points}});}
      catch(error){if(error.code==='INVALID_CHECKOUT')throw new ShopError('RENTAL_DATABASE_VALIDATION_FAILED',409);throw error;}
      return publicOrder(await owned(userId,result.orderId));
    },
    async orders(userId){const rows=await db.select('rental_orders',{select:'*',user_id:`eq.${userId}`,order:'created_at.desc',limit:'100'});
      if(!rows.length)return [];
      const orders=await db.select('orders',{select:'*',user_id:`eq.${userId}`,id:`in.(${rows.map(r=>r.order_id).join(',')})`,limit:'100'});
      return rows.flatMap(r=>{const o=orders.find(o=>o.id===r.order_id);return o?[publicOrder({r,o})]:[];});
    },
    async order(userId,id){return publicOrder(await owned(userId,id));},
    async fulfill(userId,id){
      enabled();await owned(userId,id);
      const claim=await db.rpc('server_rental_claim',{p_order_id:id,p_user_id:userId});if(claim.done)return {state:'reserved'};
      try {
        let receipt;
        if(claim.kind==='renewal'){
          const parent=await active(userId,claim.parent_order_id);
          if(Date.parse(parent.r.end_at)!==Date.parse(claim.start_at))throw new ShopError('RENEW_WINDOW_CLOSED',409);
          const d=(await availability(claim.product_id)).data;
          const cost=d.accounts.find(a=>a.account_id===claim.account_ref)?.rates[String(claim.duration_days)]?.price;
          if(!(cost>0)||cost>Number(claim.quoted_cost))throw new ShopError('PRICE_CHANGED',409);
          receipt=await client.renew(parent.r.provider_order_no,claim.duration_days);
          if(receipt.order_no!==parent.r.provider_order_no)throw Error('RECEIPT');
        } else {
          receipt=await client.reserve({productId:claim.product_id,durationDays:claim.duration_days,startAt:claim.start_at,
            accountId:claim.account_ref,reference:`olafrent-${id}`,maxPrice:claim.quoted_cost});
          if(receipt.type!=='rental'||String(receipt.product_id)!==claim.product_id||receipt.account_ref!==claim.account_ref
            ||Date.parse(receipt.start_at)!==Date.parse(claim.start_at))throw Error('RECEIPT');
        }
        if(!/^(?:API|TEST)-[A-Za-z0-9-]{1,80}$/.test(receipt.order_no||'')||!Number.isFinite(receipt.price)||receipt.price<=0
          ||Date.parse(receipt.end_at)!==Date.parse(claim.start_at)+claim.duration_days*day)throw Error('RECEIPT');
        await db.rpc('server_rental_finish',{p_order_id:id,p_token:claim.lease_token,
          p_receipt:{order_no:receipt.order_no,price:receipt.price,end_at:receipt.end_at}});
        return {state:'reserved'};
      } catch(error){
        const definite=['SLOT_UNAVAILABLE','INVALID_START_AT','DURATION_UNAVAILABLE','RENEW_WINDOW_CLOSED','PRICE_CHANGED','INSUFFICIENT_BALANCE'];
        const uncertain=error.uncertain===true||!definite.includes(error.code);
        await db.rpc('server_rental_fail',{p_order_id:id,p_token:claim.lease_token,p_uncertain:uncertain,p_code:error.code||'RENTAL_REVIEW_REQUIRED'}).catch(()=>{});
        return {state:uncertain?'uncertain':'blocked',needsSupport:true};
      }
    },
    async activate(userId,id){const {r}=await active(userId,id);const result=await client.activate(r.provider_order_no);
      if(result.order_no!==r.provider_order_no||!['active','waiting'].includes(result.rental_status))throw new ShopError('RENTAL_RESULT_UNKNOWN');
      const account=result.account;
      if(now()>=Date.parse(r.end_at)||typeof account?.username!=='string'||typeof account?.password!=='string'||!account.username||!account.password||account.username.length>4096||account.password.length>4096)throw new ShopError('RENTAL_RESULT_UNKNOWN');
      return {account:{username:account.username,password:account.password},endAt:r.end_at};
    },
    async delivery(userId,id){const {r,provider}=await active(userId,id);const account=provider.account;
      if(now()>=Date.parse(r.end_at)||typeof account?.username!=='string'||typeof account?.password!=='string'||!account.username||!account.password||account.username.length>4096||account.password.length>4096)throw new ShopError('RENTAL_RESULT_UNKNOWN');
      return {account:{username:account.username,password:account.password},endAt:r.end_at};
    },
    async guard(userId,id){const {r}=await active(userId,id);const result=await client.code(r.provider_order_no);
      if(now()>=Date.parse(r.end_at)||!/^[A-Z0-9]{5}$/.test(result.code||'')||!Number.isInteger(result.valid_for_sec)||result.valid_for_sec<0||result.valid_for_sec>30)throw new ShopError('RENTAL_RESULT_UNKNOWN');
      return {code:result.code,validForSeconds:result.valid_for_sec};
    }
  };
}
