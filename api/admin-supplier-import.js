import { requireSupplierAdmin } from '../lib/suppliers/admin-access.js';
import { SupplierConnectionError } from '../lib/suppliers/499k/client.js';
import { importOfflineCatalog } from '../lib/suppliers/import-offline.js';

export function createImportHandler({env=process.env,fetcher=fetch,now=Date.now}={}){
  let running=false,nextAllowed=0;
  return async (req,res)=>{
    res.setHeader('Cache-Control','no-store');
    if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({success:false,code:'METHOD_NOT_ALLOWED'});}
    let acquired=false;
    try{
      await requireSupplierAdmin(req,{env,fetcher});
      if(running||now()<nextAllowed)throw new SupplierConnectionError('IMPORT_RATE_LIMITED',429,Math.max(1,Math.ceil((nextAllowed-now())/1000)));
      acquired=true;running=true;nextAllowed=now()+60000;
      const result=await importOfflineCatalog({env,fetcher});
      return res.status(200).json({success:true,supplier:'499k',...result});
    }catch(error){
      const safe=error instanceof SupplierConnectionError?error:new SupplierConnectionError('IMPORT_FAILED',503);
      if(safe.retryAfter)res.setHeader('Retry-After',String(safe.retryAfter));
      return res.status(safe.status).json({success:false,code:safe.code,errors:1});
    }finally{if(acquired)running=false;}
  };
}
export default createImportHandler();
