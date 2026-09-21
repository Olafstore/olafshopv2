import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {encryptSupplierAccount} from '../lib/suppliers/delivery-crypto.js';
const require=createRequire(`${process.env.PGLITE_TEST_ROOT || process.cwd()}/package.json`);
const {PGlite}=require('@electric-sql/pglite');
const user='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222';
const product='33333333-3333-4333-8333-333333333333';
const request='44444444-4444-4444-8444-444444444444';

test('supplier checkout: permissions, legacy preservation, payment evidence, leases and delivery atomicity',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated,service_role;
      create table auth.users(id uuid primary key, email text);
      create table profiles(id uuid primary key, role text, status text);
      create table products(id text primary key, price numeric, stock integer);
      insert into products values('legacy',49,10);
      create table orders(id uuid primary key default gen_random_uuid(), order_number text unique not null,
        user_id uuid not null references auth.users(id), customer_name text default '', customer_email text default '',
        status text default 'awaiting_payment', subtotal numeric default 0, total numeric default 0,
        fee numeric default 0, currency text default 'THB', payment_method text default 'promptpay',
        payment_reference text, expires_at timestamptz, payment_status text default 'pending',
        points_redeemed_amount numeric default 0, discount_amount numeric default 0, discount_code_id uuid,
        delivery_note text, delivered_payload text);
      create table order_items(id bigint generated always as identity primary key, order_id uuid references orders(id),
        product_id text not null references products(id));
      create table payment_verifications(id uuid primary key default gen_random_uuid(), order_id uuid references orders(id),
        user_id uuid, status text, verified_amount numeric, provider_transaction_id text);
      insert into auth.users values('${user}','fixture@example.invalid'),('${other}','other@example.invalid');
      insert into profiles values('${user}','customer','active'),('${other}','customer','active');
    `);
    await db.exec(readFileSync(new URL('../supabase-supplier-access.sql',import.meta.url),'utf8'));
    await db.exec(readFileSync(new URL('../supabase-supplier-checkout.sql',import.meta.url),'utf8'));
    await db.exec(`insert into supplier_products(id,supplier,supplier_product_id,product_type,platform,name,stock,price,selling_price,is_visible,status)
      values('${product}','499k','123','offline','steam','Fixture',1,75,100,true,'active')`);
    const role=async name=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.role',$1,false)",[name]);await db.exec(`set role ${name}`);};
    const create=(id=request,cost=75,stock=1)=>db.query('select server_create_supplier_checkout($1,$2,$3,$4,$5) as result',[user,product,id,cost,stock]);
    await role('authenticated');
    await assert.rejects(create(),/permission denied/);
    await assert.rejects(db.query('select * from supplier_checkouts'),/permission denied/);
    await assert.rejects(db.query('select * from supplier_deliveries'),/permission denied/);
    await role('service_role');
    await assert.rejects(create(request,76),/SUPPLIER_PRICE_CHANGED/);
    await assert.rejects(create(request,75,0),/SUPPLIER_OUT_OF_STOCK/);
    const first=(await create()).rows[0].result;
    const order=first.order.id;
    assert.equal(first.alreadyCreated,false);
    assert.equal((await create()).rows[0].result.order.id,order);
    assert.equal((await create()).rows[0].result.alreadyCreated,true);
    await assert.rejects(db.query("select server_create_supplier_checkout($1,$2,$3,75,1,'wallet')",[user,product,request]),/IDEMPOTENCY_CONFLICT/);
    await assert.rejects(create('55555555-5555-4555-8555-555555555555'),/SUPPLIER_OUT_OF_STOCK/);
    const claim=()=>db.query('select server_claim_supplier_checkout($1,$2) as result',[order,user]);
    await assert.rejects(claim(),/VERIFIED_PAYMENT_REQUIRED/);
    await assert.rejects(db.query('select server_claim_supplier_checkout($1,$2)',[order,other]),/ORDER_NOT_FOUND/);
    await db.exec('reset role');
    await db.query("update orders set payment_status='verified',status='confirmed' where id=$1",[order]);
    await role('service_role');
    await assert.rejects(claim(),/VERIFIED_PAYMENT_REQUIRED/);
    await db.exec('reset role');
    await db.query("insert into payment_verifications(order_id,user_id,status,verified_amount,provider_transaction_id) values($1,$2,'verified',100,'fixture-payment')",[order,user]);
    await assert.rejects(db.query('update orders set total=1 where id=$1',[order]),/SUPPLIER_ORDER_IMMUTABLE/);
    await assert.rejects(db.query("update orders set status='cancelled' where id=$1",[order]),/SUPPLIER_REFUND_REVIEW_REQUIRED/);
    await assert.rejects(db.query("update orders set status='delivered' where id=$1",[order]),/SUPPLIER_DELIVERY_REQUIRED/);
    await role('service_role');
    const lease=(await claim()).rows[0].result;
    assert.equal(lease.recovery,false);
    assert.equal(lease.checkout.supplier_ref,`olaf499-${order}`);
    await assert.rejects(claim(),/SUPPLIER_FULFILLMENT_BUSY/);
    await db.query("select server_fail_supplier_checkout($1,$2,'SUPPLIER_RESULT_UNKNOWN',true)",[order,lease.checkout.lease_token]);
    const recovery=(await claim()).rows[0].result;
    assert.equal(recovery.recovery,true);
    assert.equal(recovery.checkout.supplier_ref,lease.checkout.supplier_ref);
    const encrypted=encryptSupplierAccount(order,{username:'fixture',password:'private'},
      {SUPPLIER_DELIVERY_KEY_V1:Buffer.alloc(32,8).toString('base64')});
    const finish=(token= recovery.checkout.lease_token,provider='API-FIXTURE')=>db.query(
      'select server_finish_supplier_checkout($1,$2,$3,$4,$5,$6) as result',
      [order,token,provider,76,encrypted.ciphertext,'v1']);
    await assert.rejects(finish(lease.checkout.lease_token),/SUPPLIER_LEASE_MISMATCH/);
    assert.equal((await finish()).rows[0].result.alreadyDelivered,false);
    assert.equal((await finish()).rows[0].result.alreadyDelivered,true);
    await assert.rejects(finish(recovery.checkout.lease_token,'API-WRONG'),/SUPPLIER_RECEIPT_CONFLICT/);
    assert.equal((await claim()).rows[0].result.alreadyDelivered,true);
    assert.equal((await db.query('select margin_below_target from supplier_checkouts')).rows[0].margin_below_target,true);
    assert.equal((await db.query('select count(*)::int as n from supplier_deliveries')).rows[0].n,1);
    await db.exec('reset role');
    assert.deepEqual((await db.query('select * from products')).rows,[{id:'legacy',price:'49',stock:10}]);
    assert.equal((await db.query('select count(*)::int as n from order_items')).rows[0].n,0);
    const stored=(await db.query('select status,delivery_note,delivered_payload from orders where id=$1',[order])).rows[0];
    assert.deepEqual(stored,{status:'delivered',delivery_note:null,delivered_payload:null});
    // New guard ignores legacy orders completely.
    await db.query("insert into orders(order_number,user_id) values('LEGACY',$1)",[user]);
    await db.exec("update orders set total=49,status='cancelled' where order_number='LEGACY'");
    await role('anon');
    await assert.rejects(db.query('select * from supplier_deliveries'),/permission denied/);
    await assert.rejects(db.query('select * from supplier_checkouts'),/permission denied/);
  } finally {await db.close();}
});
