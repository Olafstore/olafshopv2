import {createShopDb,ShopError} from './shop-db.js';
import {createSupplierShop} from './shop-service.js';
import {requireSupplierAdmin} from './admin-access.js';

const actions={catalog:'GET',checkout:'POST',orders:'GET',order:'GET',delivery:'POST',guard:'POST',fulfill:'POST',publish:'POST',readiness:'GET'};
const publicCodes=new Set(['AUTH_REQUIRED','ACTIVE_ACCOUNT_REQUIRED','ORDER_NOT_FOUND','INVALID_CHECKOUT','IDEMPOTENCY_CONFLICT',
  'LIVE_PURCHASE_DISABLED','SUPPLIER_PRODUCT_UNAVAILABLE','SUPPLIER_PRICE_CHANGED','SUPPLIER_OUT_OF_STOCK',
  'OUT_OF_STOCK','VERIFIED_PAYMENT_REQUIRED','SUPPLIER_MANUAL_REVIEW_REQUIRED','SUPPLIER_FULFILLMENT_BUSY',
  'DELIVERY_NOT_READY','INVALID_GUARD_REASON','GUARD_BUSY','GUARD_WINDOW_CLOSED','SUPPLIER_RATE_LIMITED',
  'RATE_LIMITED','CODE_LIMIT_REACHED','CODE_UNAVAILABLE','ORDER_REFUNDED']);
export function createShopHandler({env=process.env,fetcher=fetch,db=createShopDb({env,fetcher}),shop=createSupplierShop({env,db}),admin=requireSupplierAdmin}={}){
  return async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store, max-age=0');
    res.setHeader('Vary','Authorization');res.setHeader('X-Content-Type-Options','nosniff');
    const action=typeof req.query?.action==='string'?req.query.action.replace(/^shop-/, ''):'';
    if(!Object.hasOwn(actions,action))return res.status(404).json({success:false,code:'ACTION_NOT_FOUND'});
    if(req.method!==actions[action]){res.setHeader('Allow',actions[action]);return res.status(405).json({success:false,code:'METHOD_NOT_ALLOWED'});}
    try{
      let body={};
      if(req.method==='POST'){
        if(!/^application\/json(?:;|$)/i.test(req.headers?.['content-type']||''))throw new ShopError('INVALID_CHECKOUT',400);
        if(req.headers?.origin && !['https://olafshop.com','https://www.olafshop.com'].includes(req.headers.origin))throw new ShopError('AUTH_REQUIRED',403);
        try{body=typeof req.body==='string'?JSON.parse(req.body):req.body || {};}catch{throw new ShopError('INVALID_CHECKOUT',400);}
        if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>4096)throw new ShopError('INVALID_CHECKOUT',400);
      }
      let data;
      if(action==='catalog')data=await shop.catalog();
      else if(action==='readiness'){await admin(req,{env,fetcher});data=await shop.readiness();}
      else if(action==='publish'){await admin(req,{env,fetcher});if(body.confirmation!=='PUBLISH_499K_OFFLINE')throw new ShopError('INVALID_CHECKOUT',400);data=await shop.publish();}
      else{
        const userId=await db.authenticate(req);
        if(action==='checkout')data=await shop.checkout(userId,{productId:body.productId,requestId:body.requestId,paymentMethod:body.paymentMethod});
        if(action==='orders')data=await shop.orders(userId);
        if(action==='order')data=await shop.order(userId,req.query?.orderId);
        if(action==='delivery')data=await shop.delivery(userId,body.orderId);
        if(action==='guard')data=await shop.guard(userId,body.orderId,{reason:body.reason});
        if(action==='fulfill')data=await shop.fulfill(userId,body.orderId);
      }
      return res.status(200).json({success:true,data});
    }catch(error){
      const code=publicCodes.has(error?.code)?error.code:'SUPPLIER_SERVICE_UNAVAILABLE';
      const retry=Number(error?.retryAfter)||(['GUARD_BUSY','SUPPLIER_RATE_LIMITED'].includes(code)?60:0);
      if(retry)res.setHeader('Retry-After',String(Math.min(3600,Math.max(1,retry))));
      return res.status(retry?429:(error instanceof ShopError?error.status:503)).json({success:false,code});
    }
  };
}
