import testHandler from '../lib/suppliers/test-handler.js';
import importHandler from '../lib/suppliers/import-handler.js';

export default function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  const action=req.query?.action;
  if(action==='test')return testHandler(req,res);
  if(action==='import')return importHandler(req,res);
  return res.status(404).json({success:false,code:'ACTION_NOT_FOUND'});
}
