import {createShopDb,ShopError} from './shop-db.js';
import {createSupplierShop} from './shop-service.js';
import {requireSupplierAdmin} from './admin-access.js';

const actions={catalog:'GET',product:'GET',diagnose:'GET',quote:'POST',checkout:'POST',orders:'GET',order:'GET',delivery:'POST',guard:'POST',fulfill:'POST',publish:'POST',hide:'POST',readiness:'GET'};
const publicCodes=new Set(['AUTH_REQUIRED','ADMIN_REQUIRED','ADMIN_CHECK_UNAVAILABLE','ACTIVE_ACCOUNT_REQUIRED','ORDER_NOT_FOUND','INVALID_CHECKOUT','IDEMPOTENCY_CONFLICT',
  'LIVE_PURCHASE_DISABLED','SUPPLIER_PRODUCT_UNAVAILABLE','SUPPLIER_PRICE_CHANGED','SUPPLIER_OUT_OF_STOCK',
  'OUT_OF_STOCK','VERIFIED_PAYMENT_REQUIRED','SUPPLIER_MANUAL_REVIEW_REQUIRED','SUPPLIER_FULFILLMENT_BUSY',
  'DELIVERY_NOT_READY','INVALID_GUARD_REASON','GUARD_BUSY','GUARD_WINDOW_CLOSED','SUPPLIER_RATE_LIMITED',
  'RATE_LIMITED','CODE_LIMIT_REACHED','CODE_UNAVAILABLE','ORDER_REFUNDED',
  'SUPPLIER_MIGRATION_REQUIRED','SUPPLIER_PERMISSION_REQUIRED','SUPPLIER_SCHEMA_MISMATCH','SUPPLIER_DATABASE_UNAVAILABLE','SERVER_CONFIG_REQUIRED',
  'MIN_TOPUP_REQUIRED','CLIENT_NOT_APPROVED','CLIENT_SUSPENDED','KEY_REVOKED','SYSTEM_DISABLED','SUPPLIER_PRODUCT_MISMATCH','SUPPLIER_INVALID_RESPONSE','SUPPLIER_UPSTREAM_BLOCKED','SUPPLIER_REQUEST_FAILED']);
export function createShopHandler({env=process.env,fetcher=fetch,db=createShopDb({env,fetcher}),shop=createSupplierShop({env,db}),admin=requireSupplierAdmin}={}){
  return async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store, max-age=0');
    res.setHeader('Vary','Authorization');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-OLAF-Supplier-Revision','supplier-auth-v5');
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
      else if(action==='product')data=await shop.product(req.query?.productId);
      else if(action==='readiness'){await admin(req,{env,fetcher});data=await shop.readiness();}
      else if(action==='diagnose'){await admin(req,{env,fetcher});data=await shop.diagnose();}
      else if(action==='publish'){await admin(req,{env,fetcher});if(body.confirmation!=='PUBLISH_499K_OFFLINE')throw new ShopError('INVALID_CHECKOUT',400);data=await shop.publish();}
      else if(action==='hide'){await admin(req,{env,fetcher});if(body.confirmation!=='HIDE_499K_PRODUCTS')throw new ShopError('INVALID_CHECKOUT',400);data=await shop.hide();}
      else{
        const userId=await db.authenticate(req);
        if(action==='quote')data=await shop.quote(userId,body.productId);
        if(action==='checkout')data=await shop.checkout(userId,{productId:body.productId,requestId:body.requestId,paymentMethod:body.paymentMethod,expectedPrice:body.expectedPrice});
        if(action==='orders')data=await shop.orders(userId);
        if(action==='order')data=await shop.order(userId,req.query?.orderId);
        if(action==='delivery')data=await shop.delivery(userId,body.orderId);
        if(action==='guard')data=await shop.guard(userId,body.orderId,{reason:body.reason});
        if(action==='fulfill')data=await shop.fulfill(userId,body.orderId);
      }
      if(action==='catalog'&&!req.headers?.authorization&&!req.headers?.cookie){
        // Only the successful public list may be shared. Do not cache errors,
        // individual details, admin actions, quotes, orders or credentials.
        // No stale-while-revalidate: visibility changes expire within 60 seconds.
        res.setHeader('Cache-Control','public, max-age=0, s-maxage=60');
      }
      return res.status(200).json({success:true,data});
    }catch(error){
      const code=publicCodes.has(error?.code)?error.code:'SUPPLIER_SERVICE_UNAVAILABLE';
      const retry=Number(error?.retryAfter)||(['GUARD_BUSY','SUPPLIER_RATE_LIMITED'].includes(code)?60:0);
      if(retry)res.setHeader('Retry-After',String(Math.min(3600,Math.max(1,retry))));
      const status=error instanceof ShopError?error.status:code==='AUTH_REQUIRED'?401:code==='ADMIN_REQUIRED'?403:503;
      const d=error?.diagnostics;
      const diagnostics=d?.revision==='supplier-response-v3'?{revision:d.revision,stage:['product','order','purchase_or_guard'].includes(d.stage)?d.stage:null,upstreamStatus:Number.isInteger(d.upstreamStatus)?d.upstreamStatus:null,responseFormat:['json','html','other'].includes(d.responseFormat)?d.responseFormat:null,reason:['missing_body','body_too_large','invalid_json','data_shape'].includes(d.reason)?d.reason:null}:undefined;
      return res.status(retry?429:status).json({success:false,code,...(diagnostics?{diagnostics}:{})});
    }
  };
}
