import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createSandboxClient, testSandboxConnection, retryAfterSeconds } from '../lib/suppliers/499k/client.js';
import { createHandler } from '../lib/suppliers/test-handler.js';
const env = { SUPPLIER_499K_BASE_URL:'https://store.499k-network.com', SUPPLIER_499K_API_MODE:'sandbox', SUPPLIER_499K_API_KEY:'499k_test_mock_only', SUPPLIER_499K_TEST_ENABLED:'true', SUPABASE_URL:'https://wtvfgwacodfrzxapwoxj.supabase.co', SUPABASE_PUBLISHABLE_KEY:'mock-public', SUPABASE_SERVICE_ROLE_KEY:'mock-service' };
const uid='11111111-1111-4111-8111-111111111111';
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers});
const good=()=>json({success:true,data:{client:{status:'approved'},password:'SENSITIVE',key_prefix:env.SUPPLIER_499K_API_KEY,balance:5000}});
const run=(fetcher,extra={})=>testSandboxConnection({env,fetcher,wait:async()=>{},...extra});

test('only sandbox GET /me is possible; raw response is never returned',async()=>{
 const result=await run(async(url,options)=>{assert.equal(url,env.SUPPLIER_499K_BASE_URL+'/api/v1/me');assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer '+env.SUPPLIER_499K_API_KEY);return good();});
 assert.deepEqual(result,{success:true,supplier:'499k',mode:'sandbox',connected:true});
});
for(const replacement of [{SUPPLIER_499K_API_KEY:''},{SUPPLIER_499K_API_KEY:'499k_live_mock_only'},{SUPPLIER_499K_API_MODE:'live'},{SUPPLIER_499K_BASE_URL:'https://example.com/api/v1'}])test('invalid config is rejected before fetch '+Object.keys(replacement)[0]+Object.values(replacement)[0],async()=>{
 await assert.rejects(run(()=>{assert.fail('network forbidden');},{env:{...env,...replacement}}));
});
for(const status of [400,401,403,404,422])test('HTTP '+status+' is safe and not retried',async()=>{
 let calls=0;await assert.rejects(run(async()=>{calls++;return json({secret:'SENSITIVE'},status);}),e=>!e.message.includes('SENSITIVE'));assert.equal(calls,1);
});
for(const status of [500,502,503,504])test('HTTP '+status+' retries once',async()=>{
 let calls=0;await assert.rejects(run(async()=>{calls++;return json({secret:'SENSITIVE'},status);}),{code:'SUPPLIER_UNAVAILABLE'});assert.equal(calls,2);
});
test('network retry is bounded and does not expose thrown URL/key',async()=>{
 let calls=0;await assert.rejects(run(async()=>{calls++;throw new Error(env.SUPPLIER_499K_API_KEY);}),{message:'SUPPLIER_NETWORK_ERROR'});assert.equal(calls,2);
});
test('429 respects Retry-After and longer cooldown is returned without retry',async()=>{
 let calls=0,waited=0;await run(async()=>++calls===1?json({},429,{'Retry-After':'2'}):good(),{wait:async ms=>{waited=ms;}});assert.equal(waited,2000);assert.equal(calls,2);
 calls=0;await assert.rejects(run(async()=>{calls++;return json({},429,{'Retry-After':'60'});}),e=>e.retryAfter===60);assert.equal(calls,1);
 assert.equal(retryAfterSeconds('invalid'),1);assert.equal(retryAfterSeconds('Thu, 01 Jan 1970 00:01:00 GMT',0),60);
});
test('timeout aborts with safe error and no retry',async()=>{
 let calls=0;await assert.rejects(run((url,{signal})=>new Promise((resolve,reject)=>{calls++;signal.addEventListener('abort',()=>reject(new Error('SENSITIVE')));}),{timeoutMs:10}),{code:'SUPPLIER_TIMEOUT'});assert.equal(calls,1);
});
for(const make of [()=>new Response('not json'),()=>json({success:true,data:{}}),()=>new Response('x'.repeat(70000))])test('malformed or oversized body is discarded',async()=>{
 await assert.rejects(run(async()=>make()),{code:'SUPPLIER_INVALID_RESPONSE'});
});
test('provider errors preserve only allowlisted codes and never raw messages',async()=>{
 await assert.rejects(run(async()=>json({success:false,error:{code:'KEY_REVOKED',message:env.SUPPLIER_499K_API_KEY}},401)),e=>e.providerCode==='KEY_REVOKED' && !JSON.stringify(e).includes(env.SUPPLIER_499K_API_KEY));
 await assert.rejects(run(async()=>json({success:false,error:{code:'SENSITIVE',message:'SENSITIVE'}})),e=>e.providerCode===null && e.code==='SUPPLIER_REQUEST_REJECTED');
});
test('sandbox product reads retain nulls and remove secret fields at both levels',async()=>{
 const product={product_id:'999001',stock:1,price:10,web_price:20,full_price:null,steam:null,password:'SENSITIVE',raw_data:{secret:'SENSITIVE'}};
 const urls=[];const client=createSandboxClient({env,fetcher:async url=>{urls.push(url);return json({success:true,data:url.includes('/999001')?product:{products:[product]}});}});
 const list=await client.getProducts(),detail=await client.getProduct();
 assert.equal(list.data.products[0].full_price,null);assert.equal(detail.data.steam,null);assert(!JSON.stringify(detail).includes('SENSITIVE'));
 assert(urls[0].endsWith('/products?type=offline'));assert(urls[1].endsWith('/products/999001?type=offline'));
 await assert.rejects(client.getProduct('../orders'),{code:'SANDBOX_PRODUCT_REQUIRED'});assert.equal(urls.length,2);
 const nested=createSandboxClient({env,fetcher:async()=>json({success:true,data:{...product,steam:{name:'Game',password:'SENSITIVE',platforms:{windows:true,secret:'SENSITIVE'}}}})});
 assert(!JSON.stringify(await nested.getProduct()).includes('SENSITIVE'));
});
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}
function mockAuth({role='admin',status='active',authStatus=200,profileStatus=200,fail=false}={}){
 const calls=[];const fetcher=async(url,options)=>{calls.push(url);if(fail)throw new Error('SENSITIVE');if(url.includes('/auth/v1/user'))return json({id:uid},authStatus);if(url.includes('/rest/v1/profiles?'))return json([{id:uid,role,status}],profileStatus);return good();};return {calls,fetcher};
}
const req={method:'POST',headers:{authorization:'Bearer mock-user'},body:{role:'admin'},query:{role:'admin'}};
test('unauthenticated customer denied without any upstream request',async()=>{
 const m=mockAuth(),res=response();await createHandler({env,fetcher:m.fetcher})({...req,headers:{}},res);assert.equal(res.statusCode,401);assert.equal(m.calls.length,0);
});
for(const config of [{role:'customer'},{role:'admin',status:'disabled'},{authStatus:401},{profileStatus:500},{fail:true}])test('non-admin/expired/unverifiable role denied '+JSON.stringify(config),async()=>{
 const m=mockAuth(config),res=response();await createHandler({env,fetcher:m.fetcher})(req,res);assert(res.statusCode>=400);assert(!m.calls.some(u=>u.includes('499k-network')));assert(!JSON.stringify(res.body).includes('SENSITIVE'));
});
test('active admin allowed; body/query role cannot substitute for database role; throttle applies',async()=>{
 const m=mockAuth(),h=createHandler({env,fetcher:m.fetcher}),res=response();await h(req,res);assert.equal(res.statusCode,200);assert.deepEqual(res.body,{success:true,supplier:'499k',mode:'sandbox',connected:true});assert.equal(res.headers['Cache-Control'],'no-store');
 const again=response();await h(req,again);assert.equal(again.statusCode,429);assert.equal(m.calls.filter(u=>u.includes('499k-network')).length,1);
});
test('disabled or unconfigured endpoint fails closed',async()=>{
 for(const changes of [{SUPPLIER_499K_TEST_ENABLED:'false'},{SUPABASE_SERVICE_ROLE_KEY:''}]){const m=mockAuth(),res=response();await createHandler({env:{...env,...changes},fetcher:m.fetcher})(req,res);assert.equal(res.statusCode,503);assert(!m.calls.some(u=>u.includes('499k-network')));}
});
test('GET rejected, no external calls',async()=>{const m=mockAuth(),res=response();await createHandler({env,fetcher:m.fetcher})({...req,method:'GET'},res);assert.equal(res.statusCode,405);assert.equal(m.calls.length,0);});
test('new server modules do not log and example contains no real credentials',()=>{
 for(const file of ['lib/suppliers/499k/client.js','lib/suppliers/admin-access.js','lib/suppliers/test-handler.js','lib/suppliers/import-handler.js','api/admin-supplier.js']){const s=readFileSync(new URL('../'+file,import.meta.url),'utf8');assert(!/console\./.test(s));assert(!/499k_(test|live)_[a-zA-Z0-9]{16}/.test(s));}
 const example=readFileSync(new URL('../.env.example',import.meta.url),'utf8');assert(example.includes('SUPPLIER_499K_API_KEY=\n'));assert(example.includes('SUPABASE_SERVICE_ROLE_KEY=\n'));
});
test('browser source contains no server secret access or supplier client imports',()=>{
 const root=new URL('../',import.meta.url);
 const files=readdirSync(root).filter(f=>/\.(js|html)$/.test(f));
 for(const file of files){const source=readFileSync(new URL(file,root),'utf8');assert(!/SUPABASE_SERVICE_ROLE_KEY|SUPPLIER_499K_API_KEY|lib\/suppliers\//.test(source),file);}
 const key=process.env.SUPPLIER_499K_API_KEY;
 if(key){
  const scan=dir=>{for(const file of readdirSync(dir,{withFileTypes:true})){
   if(['node_modules','.git','.chrome-qa','.vercel'].includes(file.name)||file.name==='.env.local')continue;
   const url=new URL(file.name+(file.isDirectory()?'/':''),dir);
   if(file.isDirectory())scan(url);
   else if(/\.(js|mjs|html|json|css|md|sql|txt)$/.test(file.name))assert(!readFileSync(url,'utf8').includes(key),'Secret found in '+file.name);
  }};scan(root);
 }
 for(const file of ['.gitignore','.vercelignore'])assert(readFileSync(new URL(file,root),'utf8').includes('.env.*'));
});
