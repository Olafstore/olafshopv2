import {requireSupplierAdmin} from '../lib/suppliers/admin-access.js';
import {readSupplierProducts,SupplierConnectionError,supplierConfigStatus} from '../lib/suppliers/499k/client.js';
import passwordHandler from '../lib/admin/user-password-handler.js';
import importHandler from '../lib/suppliers/import-handler.js';

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
      return res.status(e.status).json({success:false,error:{code:e.providerCode || e.code,message:e.code}});
    }
  };
}
export function createAdminRouter({readHandler=createReadHandler(),userPasswordHandler=passwordHandler,catalogImportHandler=importHandler}={}) {
  return function handler(req,res) {
    if(req.query?.adminRoute==='user-password')return userPasswordHandler(req,res);
    if(req.query?.adminRoute){
      res.setHeader('Cache-Control','no-store');
      return res.status(404).json({success:false,error:{code:'ACTION_NOT_FOUND',message:'Unknown admin route'}});
    }
    if(req.query?.action==='import')return catalogImportHandler(req,res);
    return readHandler(req,res);
  };
}
export default createAdminRouter();
