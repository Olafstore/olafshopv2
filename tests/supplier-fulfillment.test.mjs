import test from 'node:test';
import assert from 'node:assert/strict';
import {create499kFulfillmentClient} from '../lib/suppliers/499k/fulfillment-client.js';
import {encryptSupplierAccount,decryptSupplierAccount} from '../lib/suppliers/delivery-crypto.js';

const env={SUPPLIER_499K_BASE_URL:'https://store.499k-network.com',SUPPLIER_499K_API_KEY:'499k_live_test_fixture',SUPPLIER_499K_LIVE_PURCHASE_ENABLED:'true'};
const orderId='11111111-1111-4111-8111-111111111111';
const reference=`olaf499-${orderId}`;
const input={productId:'123',reference,maximumCost:'75.00'};
const account={username:'fixture-user',password:'fixture-password'};
const product={product_id:'123',type:'offline',platform:'steam',price:75,stock:1,available:true};
const receipt={...product,order_no:'API-FIXTURE',ref:reference,account};
const json=(data,status=200)=>new Response(JSON.stringify({success:true,data}),{status});

test('encryption binds credentials to order, rejects tampering and whitelists fields',()=>{
  const cryptoEnv={SUPPLIER_DELIVERY_KEY_V1:Buffer.alloc(32,7).toString('base64')};
  const encrypted=encryptSupplierAccount(orderId,{...account,api_key:'NEVER_SAVE'},cryptoEnv);
  assert(!encrypted.ciphertext.includes('fixture'));
  assert(!encrypted.ciphertext.includes('NEVER_SAVE'));
  assert.deepEqual(decryptSupplierAccount(orderId,encrypted.ciphertext,cryptoEnv),account);
  assert.notEqual(encryptSupplierAccount(orderId,account,cryptoEnv).ciphertext,encrypted.ciphertext);
  assert.throws(()=>decryptSupplierAccount('22222222-2222-4222-8222-222222222222',encrypted.ciphertext,cryptoEnv),/DELIVERY_DECRYPT_FAILED/);
  const parts=encrypted.ciphertext.split('.'); const bytes=Buffer.from(parts[3],'base64url'); bytes[0]^=1; parts[3]=bytes.toString('base64url');
  assert.throws(()=>decryptSupplierAccount(orderId,parts.join('.'),cryptoEnv),/DELIVERY_DECRYPT_FAILED/);
  assert.throws(()=>encryptSupplierAccount(orderId,account,{}),/DELIVERY_KEY_REQUIRED/);
});
for(const override of [{SUPPLIER_499K_LIVE_PURCHASE_ENABLED:'false'},{SUPPLIER_499K_API_KEY:'499k_test_fixture'},{SUPPLIER_499K_BASE_URL:'https://attacker.invalid'}]) {
  test('disabled, sandbox or untrusted origin blocks live transport '+Object.keys(override)[0],async()=>{
    const client=create499kFulfillmentClient({env:{...env,...override},fetcher:()=>assert.fail('network forbidden')});
    await assert.rejects(client.purchase(input));
  });
}
for(const status of [200,201]) test(`purchase accepts ${status}, uses persisted ref and only returns necessary fields`,async()=>{
  const calls=[];
  const client=create499kFulfillmentClient({env,fetcher:async(url,options)=>{
    calls.push({url,options});
    if(options.method==='GET')return json(product);
    assert.deepEqual(JSON.parse(options.body),{product_id:'123',type:'offline',ref:reference});
    assert.equal(options.redirect,'error');
    return json({...receipt,idempotent:status===200,key:env.SUPPLIER_499K_API_KEY,balance_after:10000},status);
  }});
  const result=await client.purchase(input);
  assert.equal(calls.length,2); assert.equal(result.idempotent,status===200);
  assert(!JSON.stringify(result).includes(env.SUPPLIER_499K_API_KEY));
  assert(!('balance_after' in result));
});
for(const changed of [{price:75.01},{stock:0,available:false},{type:'rental'},{platform:'other'}]) {
  test('preflight blocks price, stock and type changes '+JSON.stringify(changed),async()=>{
    let calls=0;
    const client=create499kFulfillmentClient({env,fetcher:async(_url,options)=>{
      calls++;assert.equal(options.method,'GET');return json({...product,...changed});
    }});
    await assert.rejects(client.purchase(input));assert.equal(calls,1);
  });
}
test('uncertain POST is not retried and does not expose upstream exception',async()=>{
  let calls=0;
  const client=create499kFulfillmentClient({env,fetcher:async(_url,options)=>{
    calls++; if(options.method==='GET')return json(product);throw new Error('secret fixture');
  }});
  await assert.rejects(client.purchase(input),e=>e.code==='SUPPLIER_REQUEST_FAILED' && e.uncertain && !e.message.includes('secret'));
  assert.equal(calls,2);
});
test('recovery reuses exact ref without blocking on now sold-out product',async()=>{
  let calls=0;
  const client=create499kFulfillmentClient({env,fetcher:async(url,options)=>{
    calls++;assert(url.endsWith('/orders'));assert.equal(JSON.parse(options.body).ref,reference);
    return json({...receipt,idempotent:true});
  }});
  assert.equal((await client.purchase({...input,recovery:true})).idempotent,true);assert.equal(calls,1);
});
test('mismatched receipt is uncertain, not a reason to generate a new ref',async()=>{
  const client=create499kFulfillmentClient({env,fetcher:async(_url,options)=>options.method==='GET'?json(product):json({...receipt,ref:'wrong'})});
  await assert.rejects(client.purchase(input),e=>e.code==='SUPPLIER_RECEIPT_MISMATCH' && e.uncertain);
});
test('rate limit returns Retry-After, suppresses raw message and does not auto retry',async()=>{
  let calls=0;
  const client=create499kFulfillmentClient({env,fetcher:async()=>{
    calls++;return new Response(JSON.stringify({success:false,error:{code:'RATE_LIMITED',message:'PRIVATE'}}),{status:429,headers:{'Retry-After':'12'}});
  }});
  await assert.rejects(client.purchase({...input,recovery:true}),e=>e.code==='RATE_LIMITED' && e.retryAfter===12 && !e.uncertain);
  assert.equal(calls,1);
});
test('Steam Guard starts one round with reason and refreshes with empty body',async()=>{
  const bodies=[];
  const client=create499kFulfillmentClient({env,fetcher:async(url,options)=>{
    assert(url.endsWith('/orders/API-FIXTURE/code'));bodies.push(JSON.parse(options.body));
    return json({code:'ABC12',valid_for_sec:21,window:{expires_in_sec:54,new_round:bodies.length===1},code_requests:{used:1,max:3},secret:'NEVER_RETURN'});
  }});
  const result=await client.steamGuard({providerOrderNo:'API-FIXTURE',reason:'Customer login'});
  await client.steamGuard({providerOrderNo:'API-FIXTURE'});
  assert.deepEqual(bodies,[{reason:'Customer login'},{}]);assert(!('secret' in result));
  await assert.rejects(client.steamGuard({providerOrderNo:'API-FIXTURE',reason:'x'}),{code:'INVALID_GUARD_REASON'});
});
test('Steam Guard timeout is not retried',async()=>{
  let calls=0; const client=create499kFulfillmentClient({env,fetcher:async()=>{calls++;throw new Error('PRIVATE');}});
  await assert.rejects(client.steamGuard({providerOrderNo:'API-FIXTURE',reason:'Customer login'}),e=>e.uncertain && e.code==='SUPPLIER_REQUEST_FAILED');
  assert.equal(calls,1);
});
