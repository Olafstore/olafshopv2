import {supplierHeaders, SupplierConnectionError, retryAfterSeconds} from './client.js';

const codes=new Set(['INVALID_START_AT','DURATION_UNAVAILABLE','SLOT_UNAVAILABLE','RENTAL_NOT_STARTED','RENTAL_EXPIRED',
  'ACTIVATION_BUSY','ACTIVATION_FAILED','RENEW_WINDOW_CLOSED','PRICE_CHANGED','OUT_OF_STOCK','INSUFFICIENT_BALANCE',
  'RATE_LIMITED','ORDER_REFUNDED','PRODUCT_NOT_FOUND','CLIENT_NOT_APPROVED','MIN_TOPUP_REQUIRED']);
const id=value=>/^[1-9][0-9]{0,15}$/.test(String(value||''));
const number=value=>/^(?:API|TEST)-[A-Za-z0-9-]{1,80}$/.test(value||'');
export function createRentalClient({env=process.env,fetcher=fetch}={}) {
  async function request(path,body) {
    if(typeof window!=='undefined'||env.SUPPLIER_499K_BASE_URL!=='https://store.499k-network.com')throw new SupplierConnectionError('SUPPLIER_CONFIG_REQUIRED',503);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    const write=body!==undefined;
    try {
      const response=await fetcher(`${env.SUPPLIER_499K_BASE_URL}/api/v1${path}`,{
        method:write?'POST':'GET',redirect:'error',signal:controller.signal,
        headers:{...supplierHeaders(env),...(write?{'Content-Type':'application/json'}:{})},
        ...(write?{body:JSON.stringify(body)}:{})
      });
      const reader=response.body?.getReader();if(!reader)throw Error('BODY');
      const chunks=[];let size=0;
      try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1048576)throw Error('SIZE');chunks.push(Buffer.from(value));}}
      finally {await reader.cancel().catch(()=>{});}
      const envelope=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(!response.ok||envelope.success!==true) {
        const error=new SupplierConnectionError(codes.has(envelope.error?.code)?envelope.error.code:'RENTAL_PROVIDER_FAILED',response.status===429?429:409);
        error.uncertain=write&&(response.status>=500||!codes.has(envelope.error?.code));
        error.retryAfter=response.status===429?retryAfterSeconds(response.headers.get('retry-after')):
          Math.min(3600,Math.max(0,Number(envelope.error?.retry_after_sec ?? envelope.data?.retry_after_sec)||0));
        throw error;
      }
      if(!envelope.data||typeof envelope.data!=='object'||Array.isArray(envelope.data))throw Error('SHAPE');
      // Never log or persist the raw response (may contain credentials/balances).
      return envelope.data;
    } catch(error) {
      if(error instanceof SupplierConnectionError)throw error;
      const safe=new SupplierConnectionError('RENTAL_RESULT_UNKNOWN',503);safe.uncertain=write;throw safe;
    } finally {clearTimeout(timer);}
  }
  function orderPath(orderNo){if(!number(orderNo))throw new SupplierConnectionError('INVALID_RENTAL_ORDER',400);return `/orders/${orderNo}`;}
  return {
    async reserve({productId,durationDays,startAt,accountId,reference,maxPrice}) {
      if(!id(productId)||!Number.isSafeInteger(durationDays)||durationDays<1||!Number.isSafeInteger(accountId)||accountId<1
        ||!/^olafrent-[0-9a-f-]{36}$/.test(reference||'')||!Number.isFinite(Date.parse(startAt))||!(Number(maxPrice)>0))throw new SupplierConnectionError('INVALID_CHECKOUT',400);
      return request('/orders',{type:'rental',product_id:String(productId),duration_days:durationDays,start_at:startAt,account_id:accountId,ref:reference,max_price:Number(maxPrice)});
    },
    order:orderNo=>request(orderPath(orderNo)),
    activate:orderNo=>request(`${orderPath(orderNo)}/activate`,{}),
    code:orderNo=>request(`${orderPath(orderNo)}/code`,{}),
    renew(orderNo,durationDays){
      if(!Number.isSafeInteger(durationDays)||durationDays<1)throw new SupplierConnectionError('INVALID_CHECKOUT',400);
      // Deliberately one POST only. This endpoint is NOT idempotent.
      return request(`${orderPath(orderNo)}/renew`,{duration_days:durationDays});
    }
  };
}
