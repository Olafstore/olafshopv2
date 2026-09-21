import {requireSupplierAdmin} from '../lib/suppliers/admin-access.js';
import {readSupplierProducts,SupplierConnectionError,supplierConfigStatus,testSandboxPurchase,supplierErrorDiagnostics} from '../lib/suppliers/499k/client.js';
import passwordHandler from '../lib/admin/user-password-handler.js';
import importHandler from '../lib/suppliers/import-handler.js';
import {createShopHandler} from '../lib/suppliers/shop-handler.js';

export function createReadHandler({env=process.env,fetcher=fetch}={}) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store');
    if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({success:false,error:{code:'METHOD_NOT_ALLOWED',message:'Use GET'}});}
    if(req.query?.action && !['products','test','status'].includes(req.query.action))return res.status(404).json({success:false,error:{code:'ACTION_NOT_FOUND',message:'Read-only endpoint'}});
    try {
      await requireSupplierAdmin(req,{env,fetcher});
      if(req.query?.action==='status')return res.status(200).json({success:true,data:supplierConfigStatus(env)});
      return res.status(200).json(await readSupplierProducts({env,fetcher}));
    }catch(caught){
      const e=caught instanceof SupplierConnectionError?caught:new SupplierConnectionError('SUPPLIER_READ_FAILED',503);
      if(e.retryAfter)res.setHeader('Retry-After',String(e.retryAfter));
      return res.status(e.status).json({success:false,error:{code:e.providerCode || e.code,message:e.code},diagnostics:supplierErrorDiagnostics(e)});
    }
  };
}
export function createSandboxPurchaseHandler({env=process.env,fetcher=fetch}={}) {
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({success:false,code:'METHOD_NOT_ALLOWED'});}
    try{
      await requireSupplierAdmin(req,{env,fetcher});
      if(env.SUPPLIER_499K_SANDBOX_PURCHASE_ENABLED!=='true')throw new SupplierConnectionError('SANDBOX_PURCHASE_DISABLED',503);
      return res.status(200).json(await testSandboxPurchase({env,fetcher}));
    }catch(e){
      const safe=e instanceof SupplierConnectionError?e:new SupplierConnectionError('SANDBOX_TEST_FAILED',503);
      if(safe.retryAfter)res.setHeader('Retry-After',String(safe.retryAfter));
      return res.status(safe.status).json({success:false,code:safe.providerCode || safe.code,diagnostics:supplierErrorDiagnostics(safe)});
    }
  };
}
export function createAdminRouter({readHandler=createReadHandler(),userPasswordHandler=passwordHandler,catalogImportHandler=importHandler,sandboxPurchaseHandler=createSandboxPurchaseHandler(),shopHandler=createShopHandler()}={}) {
  return function handler(req,res) {
    if(req.query?.adminRoute==='user-password')return userPasswordHandler(req,res);
    if(req.query?.adminRoute){
      res.setHeader('Cache-Control','no-store');
      return res.status(404).json({success:false,error:{code:'ACTION_NOT_FOUND',message:'Unknown admin route'}});
    }
    if(typeof req.query?.action==='string' && req.query.action.startsWith('shop-'))return shopHandler(req,res);
    if(req.query?.action==='import')return catalogImportHandler(req,res);
    if(req.query?.action==='sandbox-purchase')return sandboxPurchaseHandler(req,res);
    return readHandler(req,res);
  };
}
export default createAdminRouter();
