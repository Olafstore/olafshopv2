import {createShopDb,ShopError} from './shop-db.js';
import {createRentalShop} from './rental-service.js';
const methods={catalog:'GET',product:'GET',availability:'GET',orders:'GET',order:'GET',quote:'POST',checkout:'POST',fulfill:'POST',activate:'POST',delivery:'POST',guard:'POST'};
const safeCodes=new Set(['AUTH_REQUIRED','ACTIVE_ACCOUNT_REQUIRED','RENTAL_DISABLED','ORDER_NOT_FOUND','ORDER_REPLACED','UNPAID_POINT_EVIDENCE_REQUIRED','INVALID_CHECKOUT',
  'INVALID_START_AT','DURATION_UNAVAILABLE','SLOT_UNAVAILABLE','SUPPLIER_PRICE_CHANGED','IDEMPOTENCY_CONFLICT','RENEW_WINDOW_CLOSED',
  'RENTAL_NOT_STARTED','RENTAL_NOT_ACTIVE','RENTAL_EXPIRED','ACTIVATION_BUSY','ACTIVATION_FAILED','RENTAL_RENEWAL_BUSY',
  'RENTAL_RESULT_UNKNOWN','RATE_LIMITED','SUPPLIER_RATE_LIMITED','SUPPLIER_DATABASE_RATE_LIMITED','SUPPLIER_MANUAL_REVIEW_REQUIRED',
  'VERIFIED_PAYMENT_REQUIRED','SUPPLIER_MIGRATION_REQUIRED','SUPPLIER_PERMISSION_REQUIRED','SUPPLIER_SCHEMA_MISMATCH','SUPPLIER_DATABASE_UNAVAILABLE','SERVER_CONFIG_REQUIRED','RENTAL_DATABASE_VALIDATION_FAILED','POINT_BALANCE_INSUFFICIENT']);
export function createRentalHandler({env=process.env,fetcher=fetch,db=createShopDb({env,fetcher}),shop=createRentalShop({env,fetcher,db})}={}) {
  return async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Authorization');res.setHeader('X-Content-Type-Options','nosniff');
    const action=String(req.query?.action||'').replace(/^rent-/,'');
    if(!Object.hasOwn(methods,action))return res.status(404).json({success:false,code:'ACTION_NOT_FOUND'});
    if(req.method!==methods[action]){res.setHeader('Allow',methods[action]);return res.status(405).json({success:false,code:'METHOD_NOT_ALLOWED'});}
    try {
      let body={};
      if(req.method==='POST'){
        if(!/^application\/json(?:;|$)/i.test(req.headers?.['content-type']||''))throw new ShopError('INVALID_CHECKOUT',400);
        if(req.headers?.origin&&!['https://olafshop.com','https://www.olafshop.com'].includes(req.headers.origin))throw new ShopError('AUTH_REQUIRED',403);
        try{body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};}catch{throw new ShopError('INVALID_CHECKOUT',400);}
        if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>4096)throw new ShopError('INVALID_CHECKOUT',400);
      }
      if(action==='catalog')return res.status(200).json({success:true,data:await shop.catalog()});
      if(action==='product')return res.status(200).json({success:true,data:await shop.product(req.query?.productId)});
      const user=await db.authenticate(req);let data;
      if(action==='availability')data=await shop.availability(user,req.query?.productId);
      if(action==='orders')data=await shop.orders(user);
      if(action==='order')data=await shop.order(user,req.query?.orderId);
      if(action==='quote')data=await shop.quote(user,body);
      if(action==='checkout')data=await shop.checkout(user,body);
      if(action==='fulfill')data=await shop.fulfill(user,body.orderId);
      if(action==='activate')data=await shop.activate(user,body.orderId);
      if(action==='delivery')data=await shop.delivery(user,body.orderId);
      if(action==='guard')data=await shop.guard(user,body.orderId);
      return res.status(200).json({success:true,data});
    } catch(error){
      const code=safeCodes.has(error.code)?error.code:'RENTAL_SERVICE_UNAVAILABLE';
      if(error.retryAfter)res.setHeader('Retry-After',String(Math.min(3600,Math.max(1,error.retryAfter))));
      return res.status(error.status>=400&&error.status<=599?error.status:503).json({success:false,code});
    }
  };
}
