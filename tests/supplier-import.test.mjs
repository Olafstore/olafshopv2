import test from 'node:test';
import assert from 'node:assert/strict';
import {importOfflineCatalog} from '../lib/suppliers/import-offline.js';
import {createImportHandler} from '../lib/suppliers/import-handler.js';
const env={SUPPLIER_499K_API_MODE:'live',SUPPLIER_499K_ALLOW_LIVE_READ:'true',SUPPLIER_499K_IMPORT_ENABLED:'true',SUPPLIER_499K_BASE_URL:'https://store.499k-network.com',SUPPLIER_499K_API_KEY:'499k_live_mock_only',SUPABASE_URL:'https://wtvfgwacodfrzxapwoxj.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'mock-service'};
const product={product_id:10,type:'offline',name:'Test',stock:1,price:10,web_price:20,full_price:null,rate_percent:5,image:'https://example.com/image.jpg',denuvo:false,steam:null};
const json=data=>new Response(JSON.stringify(data));
test('live offline GET only, whitelisted data and identical duplicate protection',async()=>{
 let calls=0;
 const result=await importOfflineCatalog({env,fetcher:async(url,options)=>{
 calls++;
 if(calls===1){assert(url.endsWith('/products?type=offline'));assert.equal(options.method,'GET');return json({success:true,data:{total:2,products:[product,product]}});}
 assert(url.endsWith('/rpc/server_import_499k_offline'));const rows=JSON.parse(options.body).p_products;
 assert.equal(rows.length,1);assert.equal(rows[0].denuvo,false);assert.equal(rows[0].steam,null);assert.equal(rows[0].full_price,null);assert.equal(rows[0].image,product.image);assert(!options.body.includes(env.SUPPLIER_499K_API_KEY));
 return json({inserted:1,updated:0,duplicatesPrevented:0,errors:0});
 }});
 assert.deepEqual(result,{fetched:2,inserted:1,updated:0,duplicatesPrevented:1,errors:0});
});
for(const data of [{total:2,products:[product]},{total:1,products:[{...product,type:'sandbox'}]},{total:1,products:[{...product,price:-1}]},{total:2,products:[product,{...product,price:11}]},{total:1,products:[{...product,name:env.SUPPLIER_499K_API_KEY}]}])test('invalid snapshot cannot reach database '+JSON.stringify(data).slice(0,65),async()=>{
 let calls=0;await assert.rejects(importOfflineCatalog({env,fetcher:async()=>{calls++;return json({success:true,data});}}));assert.equal(calls,1);
});
test('disabled live reads/config fail closed before network',async()=>{
 for(const changes of [{SUPPLIER_499K_ALLOW_LIVE_READ:'false'},{SUPABASE_SERVICE_ROLE_KEY:''},{SUPPLIER_499K_IMPORT_ENABLED:'false'}])await assert.rejects(importOfflineCatalog({env:{...env,...changes},fetcher:()=>assert.fail('No network')}));
});
test('uncertain database commit is never retried or exposed',async()=>{
 let calls=0;await assert.rejects(importOfflineCatalog({env,fetcher:async()=>{if(++calls===1)return json({success:true,data:{total:1,products:[product]}});throw new Error(env.SUPABASE_SERVICE_ROLE_KEY);}}),{message:'DATABASE_IMPORT_RESULT_UNKNOWN'});assert.equal(calls,2);
});
test('import endpoint denies missing session before supplier requests',async()=>{
 const res={setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;}};
 await createImportHandler({env,fetcher:()=>assert.fail('No network')})({method:'POST',headers:{}},res);
 assert.equal(res.code,401);
});
