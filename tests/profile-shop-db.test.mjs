import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';

// Install @electric-sql/pglite outside the storefront and set PGLITE_TEST_ROOT to that directory.
const require = createRequire(`${process.env.PGLITE_TEST_ROOT || process.cwd()}/package.json`);
const { PGlite } = require('@electric-sql/pglite');
const sql = readFileSync(new URL('../supabase-profile-shop.sql', import.meta.url),'utf8');
const customer = '11111111-1111-4111-8111-111111111111';
const admin = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
const order = '44444444-4444-4444-8444-444444444444';
const attempt = '55555555-5555-4555-8555-555555555555';
const request = '66666666-6666-4666-8666-666666666666';

test('profile shop: real PostgreSQL migration, transactions and permissions', async t => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql as $$ select current_setting('request.jwt.claim.role',true) $$;
    grant usage on schema auth to authenticated,service_role,anon;
    grant execute on all functions in schema auth to authenticated,service_role,anon;
    create table public.profiles(id uuid primary key,role text,status text);
    create table public.orders(id uuid primary key,user_id uuid,payment_status text);
    create table public.order_items(order_id uuid,product_id text);
    create table public.payment_verifications(id uuid primary key,order_id uuid,user_id uuid,status text,provider text,
      provider_transaction_id text,verified_amount numeric,created_at timestamptz default now());
    create table public.mock_points(user_id uuid primary key,balance numeric not null default 0);
    create function public.admin_adjust_user_points(p_user_id uuid,p_amount numeric,p_note text)
    returns jsonb language plpgsql security definer as $$ begin
      if not exists(select 1 from public.profiles where id=auth.uid() and role='admin' and status='active') then raise exception 'ADMIN_REQUIRED'; end if;
      insert into public.mock_points values(p_user_id,p_amount) on conflict(user_id) do update set balance=mock_points.balance+p_amount;
      return jsonb_build_object('wallets',jsonb_build_array(jsonb_build_object('userId',p_user_id,'balance',(select balance from public.mock_points where user_id=p_user_id))));
    end $$;
    create function public.server_verify_point_topup_order(p_attempt_id uuid,p_provider_transaction_id text,p_verified_amount numeric,
      p_sender_name text,p_receiver_name text,p_transferred_at timestamptz,p_provider_payload jsonb)
    returns jsonb language plpgsql security definer as $$ begin
      if p_provider_payload->>'fail'='true' then raise exception 'PROVIDER_FAILED'; end if;
      update public.payment_verifications set status='verified',provider_transaction_id=p_provider_transaction_id,verified_amount=p_verified_amount where id=p_attempt_id;
      update public.orders set payment_status='verified' where id=(select order_id from public.payment_verifications where id=p_attempt_id);
      return jsonb_build_object('pointCreditAmount',p_verified_amount);
    end $$;
    create function public.server_verify_payment_and_fulfill_order(p_attempt_id uuid,p_provider_transaction_id text,p_verified_amount numeric,
      p_sender_name text,p_receiver_name text,p_transferred_at timestamptz,p_provider_payload jsonb)
    returns jsonb language sql as $$ select public.server_verify_point_topup_order(p_attempt_id,p_provider_transaction_id,p_verified_amount,
      p_sender_name,p_receiver_name,p_transferred_at,p_provider_payload) || '{"fulfilled":true}'::jsonb $$;
    insert into auth.users values('${customer}'),('${admin}'),('${other}');
    insert into public.profiles values('${customer}','customer','active'),('${admin}','admin','active'),('${other}','customer','active');
  `);
  await db.exec(sql);
  await db.exec(readFileSync(new URL('../supabase-profile-shop-deduct.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../supabase-all-order-rewards.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../supabase-admin-shop-history.sql',import.meta.url),'utf8'));
  const identity = async (id, role = 'authenticated') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[id,role]);
    await db.exec(`set role ${role}`);
  };
  const query = async (text, args=[]) => (await db.query(text,args)).rows[0];
  const state = async () => (await query('select public.shop_get_state() as s')).s;
  const adjust = async (amount=100, kind='point', req=request) => (await query(
    'select public.shop_admin_adjust($1,$2,$3,$4,$5) as s',[customer,amount,'test',req,kind])).s;
  const reset = async () => {
    await db.exec('reset role');
    await db.exec('truncate public.shop_point_ledger,public.shop_wallets,public.shop_avatar_inventory,public.shop_equipped_avatars,public.shop_admin_operations,public.shop_topup_rewards,public.orders,public.order_items,public.payment_verifications,public.mock_points');
    await identity(admin);
  };
  await identity(admin,'service_role');
  for (const id of ['iconprofile/01.png','iconprofile/iconpoint/01.png','iconprofile/iconpoint/02.png']) {
    await db.query('select public.shop_register_avatar($1,$1)',[id]);
  }
  await t.test('admin-only history scopes user, filters amounts and caps pages', async () => {
    await reset();
    for(let i=0;i<13;i++)await adjust(10,'reward',`12345678-1234-4123-8123-${String(i).padStart(12,'0')}`);
    const history=(offset=0,kind='earned')=>query('select shop_admin_history($1,$2,$3) as rows',[customer,offset,kind]);
    assert.equal((await history()).rows.length,11);
    assert.equal((await history(10)).rows.length,3);
    assert.equal((await history(0,'spent')).rows.length,0);
    assert.equal((await query('select shop_admin_history($1) as rows',[other])).rows.length,0);
    await assert.rejects(history(-1),/INVALID_HISTORY_REQUEST/);
    await identity(customer);await assert.rejects(history(),/ACCESS_DENIED/);
    await identity('','anon');await assert.rejects(history(),/permission denied/);
  });
  await t.test('100 Point earns exactly 1,000 shop points; retry cannot duplicate either balance', async () => {
    await reset();
    assert.equal((await adjust()).shopPointsEarned,1000);
    await adjust();
    await identity(customer);
    assert.equal((await state()).balance,1000);
    await db.exec('reset role');
    assert.equal(Number((await query('select balance from mock_points')).balance),100);
  });
  await t.test('direct reward grants do not create money; negative Point changes earn nothing', async () => {
    await reset(); await adjust(1000,'reward');
    await adjust(-10,'point','77777777-7777-4777-8777-777777777777');
    await identity(customer);
    assert.equal((await state()).balance,1000);
    await db.exec('reset role');
    assert.equal(Number((await query('select balance from mock_points')).balance),-10);
  });
  await t.test('admin deduction is audited, idempotent, bounded and cannot create money', async () => {
    await reset(); await adjust(1000,'reward');
    const req='77777777-7777-4777-8777-777777777777';
    assert.equal((await adjust(-300,'reward',req)).shopBalance,700);
    assert.equal((await adjust(-300,'reward',req)).shopBalance,700);
    await assert.rejects(adjust(-301,'reward',req),/REQUEST_CONFLICT/);
    await assert.rejects(adjust(-701,'reward','88888888-8888-4888-8888-888888888888'),/SHOP_POINTS_INSUFFICIENT/);
    await assert.rejects(adjust(-0.5,'reward','88888888-8888-4888-8888-888888888888'),/INVALID_AMOUNT/);
    await assert.rejects(db.query('select public.shop_admin_adjust($1,-10,null,$2,\'reward\')',[customer,'88888888-8888-4888-8888-888888888888']),/NOTE_REQUIRED/);
    await identity(customer);
    await assert.rejects(adjust(-10,'reward',req),/ACCESS_DENIED/);
    assert.equal((await state()).balance,700);
    const entry=await query('select amount,balance_after,reason from shop_point_ledger where amount<0');
    assert.equal(Number(entry.amount),-300);assert.equal(Number(entry.balance_after),700);assert(entry.reason.includes('test'));
    await db.exec('reset role');
    assert.equal((await db.query('select * from mock_points')).rows.length,0);
    assert.equal((await db.query('select * from shop_admin_operations')).rows.length,2);
    await identity(admin);assert.equal((await adjust(-700,'reward','99999999-9999-4999-8999-999999999999')).shopBalance,0);
  });
  await t.test('purchase once, retry without charge, owns and equips purchased avatar', async () => {
    await reset(); await adjust(); await identity(customer);
    await db.query('select public.shop_purchase_avatar($1)',['iconprofile/iconpoint/01.png']);
    await db.query('select public.shop_purchase_avatar($1)',['iconprofile/iconpoint/01.png']);
    assert.deepEqual((await state()).owned,['iconprofile/iconpoint/01.png']);
    assert.equal((await state()).balance,0);
    await db.query('select public.shop_equip_avatar($1)',['iconprofile/iconpoint/01.png']);
    assert.equal((await state()).equipped,'iconprofile/iconpoint/01.png');
    await assert.rejects(db.query('select public.shop_purchase_avatar($1)',['iconprofile/iconpoint/02.png']),/SHOP_POINTS_INSUFFICIENT/);
  });
  await t.test('free avatars work without points; non-owned paid avatars cannot be equipped', async () => {
    await reset(); await identity(customer);
    await db.query('select public.shop_equip_avatar($1)',['iconprofile/01.png']);
    assert.equal((await state()).equipped,'iconprofile/01.png');
    assert.equal((await state()).balance,0);
    await assert.rejects(db.query('select public.shop_equip_avatar($1)',['iconprofile/iconpoint/01.png']),/AVATAR_NOT_OWNED/);
  });
  await t.test('customer cannot mint rewards, register free paid assets, edit wallet, or read another wallet', async () => {
    await reset(); await adjust(); await identity(other);
    await assert.rejects(adjust(),/ACCESS_DENIED/);
    await assert.rejects(db.query('select public.shop_credit_internal($1,1000,$2,$3)',[other,'fake','fake']),/permission denied/);
    await assert.rejects(db.query('select public.shop_register_avatar($1,$1)',['iconprofile/fake.png']),/permission denied/);
    await assert.rejects(db.query('update public.shop_wallets set balance=100000'),/permission denied/);
    assert.equal((await db.query('select * from public.shop_wallets')).rows.length,0);
    await identity('','anon');
    await assert.rejects(db.query('select public.shop_get_state()'),/permission denied/);
  });
  const seedPayment = async (status='pending', product='point-topup') => {
    await db.exec('reset role');
    await db.query('insert into public.orders values($1,$2,$3)',[order,customer,status]);
    await db.query('insert into public.order_items values($1,$2)',[order,product]);
    await db.query("insert into public.payment_verifications(id,order_id,user_id,status,provider,provider_transaction_id,verified_amount) values($1,$2,$3,$4,'rdcw','tx-test',100)",[attempt,order,customer,status]);
    await identity(admin,'service_role');
  };
  const reward = () => query('select public.shop_reward_verified_topup($1) as amount',[order]);
  await t.test('pending/rejected payments never earn rewards in any category', async () => {
    for (const [status,product] of [['pending','point-topup'],['rejected','point-topup'],['pending','game'],['rejected','game']]) {
      await reset(); await seedPayment(status,product);
      assert.equal(Number((await reward()).amount),0);
      await identity(customer); assert.equal((await state()).balance,0);
    }
  });
  await t.test('verified topup earns once and duplicate transaction cannot earn on a second order', async () => {
    await reset(); await seedPayment('verified');
    assert.equal(Number((await reward()).amount),1000);
    assert.equal(Number((await reward()).amount),0);
    await db.exec('reset role');
    await db.query('update public.orders set id=$1',[other]);
    await db.query('update public.order_items set order_id=$1',[other]);
    await db.query('update public.payment_verifications set order_id=$1',[other]);
    await identity(admin,'service_role');
    assert.equal(Number((await query('select public.shop_reward_verified_topup($1) as amount',[other])).amount),0);
    await identity(customer); assert.equal((await state()).balance,1000);
  });
  await t.test('all product categories earn once; failed reward rolls back verification', async () => {
    for (const product of ['steam-key','offline-game','account','random-game','other-product']) {
      await reset();await seedPayment('pending',product);
      const verify=payload=>query('select public.server_verify_order_with_rewards($1,$2,$3,null,null,now(),$4) as result',[attempt,'product-tx',100,payload]);
      await assert.rejects(verify({fail:true}),/PROVIDER_FAILED/);
      await db.exec('reset role');
      await db.exec("alter table shop_point_ledger add constraint product_reward_failure check(amount<1000)");
      await identity(admin,'service_role');
      await assert.rejects(verify({}),/product_reward_failure/);
      await db.exec('reset role');
      assert.equal((await query('select payment_status from orders')).payment_status,'pending');
      assert.equal((await db.query('select * from shop_topup_rewards')).rows.length,0);
      await db.exec('alter table shop_point_ledger drop constraint product_reward_failure');
      await identity(admin,'service_role');
      assert.equal((await verify({})).result.shopPointsEarned,1000);
      assert.equal((await verify({})).result.shopPointsEarned,0);
      await identity(customer);assert.equal((await state()).balance,1000);
      await assert.rejects(verify({}),/permission denied/);
    }
  });
  await t.test('successful verifier and reward are atomic; failed verifier earns nothing', async () => {
    await reset(); await seedPayment();
    const verify = payload => db.query('select public.server_verify_point_topup_with_rewards($1,$2,$3,null,null,now(),$4) as result',[attempt,'real-tx',100,payload]);
    await assert.rejects(verify({ fail:true }),/PROVIDER_FAILED/);
    await identity(customer); assert.equal((await state()).balance,0);
    await identity(admin,'service_role');
    assert.equal((await verify({})).rows[0].result.shopPointsEarned,1000);
    await identity(customer); assert.equal((await state()).balance,1000);
  });
  await t.test('ledger failure rolls back legacy Point credit as well', async () => {
    await reset();
    await db.exec('reset role');
    await db.exec("alter table public.shop_point_ledger add constraint test_force_failure check(reason not like 'แอดมินเพิ่ม Point%')");
    await identity(admin);
    await assert.rejects(adjust(),/test_force_failure/);
    await db.exec('reset role');
    assert.equal((await db.query('select * from mock_points')).rows.length,0);
    await db.exec('alter table public.shop_point_ledger drop constraint test_force_failure');
  });
  await t.test('reused admin request with changed payload is rejected, migration is rerunnable', async () => {
    await reset(); await adjust();
    await assert.rejects(adjust(200),/REQUEST_CONFLICT/);
    await db.exec('reset role'); await db.exec(sql);
    await identity(customer); assert.equal((await state()).balance,1000);
  });
  await t.test('background migration: tier pricing, ownership, private bio and atomic idempotent purchase', async () => {
    await reset();
    const bgSql = readFileSync(new URL('../supabase-profile-backgrounds.sql',import.meta.url),'utf8');
    await db.exec('reset role'); await db.exec(bgSql); await db.exec(bgSql);
    const paid='iconprofile/BGolaf/BGpoint/1.5k/test.webp';
    const free='iconprofile/BGolaf/free.webp';
    await identity(admin,'service_role');
    await db.query('select shop_register_background($1,1500)',[paid]);
    await db.query('select shop_register_background($1,0)',[free]);
    await identity(customer);
    await assert.rejects(db.query('select shop_register_background($1,0)',[paid]),/permission denied/);
    await assert.rejects(db.query('select shop_use_background($1,false)',[paid]),/AVATAR_NOT_OWNED/);
    await assert.rejects(db.query('select shop_use_background($1,true)',[paid]),/SHOP_POINTS_INSUFFICIENT/);
    await identity(admin); await adjust(200);
    await identity(customer);
    let result=(await query('select shop_use_background($1,true) as s',[paid])).s;
    assert.equal(result.balance,500); assert.equal(result.background,null);
    assert.equal((await query('select shop_use_background($1,true) as s',[paid])).s.balance,500);
    result=(await query('select shop_use_background($1,false) as s',[paid])).s;
    assert.equal(result.background,paid);
    assert.equal((await query('select shop_use_background($1,false) as s',[free])).s.background,free);
    await db.query('select shop_save_bio($1)',['Hello']);
    await assert.rejects(db.query('select shop_save_bio($1)',['x'.repeat(301)]),/INVALID_BIO/);
    await identity(other);
    result=(await query('select shop_decoration_state() as s')).s;
    assert.equal(result.bio,''); assert.equal(result.background,null); assert.deepEqual(result.backgroundOwned,[]);
    await assert.rejects(db.query('select * from shop_profile_decoration'),/permission denied/);
  });
  await t.test('monthly ranks: exact thresholds, audited funding, Bangkok reset and one-time animation claims', async () => {
    await db.exec('reset role');
    const rankSql=readFileSync(new URL('../supabase-profile-rank.sql',import.meta.url),'utf8');
    await db.exec(rankSql); await db.exec(rankSql);
    const rankState=async()=> (await query('select shop_rank_state() as s')).s;
    for (const [amount,expected] of [[100,0],[100.01,1],[500,1],[500.01,2],[900,2],[900.01,3],[1500,3],[1500.01,4],[3000,4],[3000.01,5],[5000,5],[5000.01,6]]) {
      await reset(); await adjust(amount); await identity(customer);
      const result=await rankState();
      assert.equal(result.rank,expected,`threshold ${amount}`);
      assert.equal(result.total,amount);
    }
    await reset(); await adjust(20000,'reward'); await identity(customer);
    assert.equal((await rankState()).total,0,'reward points do not count as money');
    await reset(); await adjust(-200); await identity(customer);
    assert.equal((await rankState()).total,0,'negative admin adjustment does not add rank');
    await reset(); await seedPayment('pending'); await reward(); await identity(customer);
    assert.equal((await rankState()).total,0,'unverified payments excluded');
    await reset(); await seedPayment('verified'); await reward(); await reward();
    await identity(admin); await adjust(450);
    await identity(customer);
    let result=await rankState(); assert.equal(result.total,550); assert.equal(result.rank,2);
    let claim=(await query('select shop_claim_rank_animation($1,$2) as s',[result.month,2])).s;
    assert.equal(claim.animate,true);
    assert.equal((await query('select shop_claim_rank_animation($1,$2) as s',[result.month,2])).s.animate,false);
    assert.equal((await query('select shop_claim_rank_animation($1,6) as s',[result.month])).s.animate,false,'cannot forge upgrade');
    assert.equal((await query("select shop_claim_rank_animation('2000-01-01',2) as s")).s.animate,false);
    await identity(other); assert.equal((await rankState()).total,0); assert.equal((await rankState()).seen,0);
    await assert.rejects(db.query('select * from shop_rank_seen'),/permission denied/);
    await identity('','anon'); await assert.rejects(db.query('select shop_rank_state()'),/permission denied/);
    await db.exec('reset role');
    await db.exec("update shop_admin_operations set created_at=(date_trunc('month',now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok')-interval '1 millisecond'; update shop_point_ledger set created_at=(date_trunc('month',now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok')-interval '1 millisecond'");
    await identity(customer); assert.equal((await rankState()).total,0,'prior month is excluded without clearing wallets');
    const preserved=(await state()).balance; assert(preserved>0);
    await db.exec('reset role');
    await db.exec("update shop_admin_operations set created_at=date_trunc('month',now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok'");
    await identity(customer); assert.equal((await rankState()).total,450,'midnight Bangkok is included');
    assert.equal((await state()).balance,preserved);
    await db.exec('reset role');
    const displaySql=readFileSync(new URL('../supabase-rank-display.sql',import.meta.url),'utf8');
    await db.exec(displaySql); await db.exec(displaySql);
    await identity(customer);
    assert.equal((await query('select shop_rank_badge_state() as s')).s.show,false);
    const badge=(await query('select shop_set_rank_display(true) as s')).s;
    assert.equal(badge.show,true); assert.equal(badge.rank,1);
    await identity(other); assert.equal((await query('select shop_rank_badge_state() as s')).s.show,false);
    await assert.rejects(db.query('update shop_rank_preferences set show_rank=true'),/permission denied/);
    await identity(customer); assert.equal((await query('select shop_rank_badge_state() as s')).s.show,true);
    assert.equal((await query('select shop_set_rank_display(false) as s')).s.show,false);
  });
  await t.test('public profile is opt-in, owner-managed and exposes only approved fields',async()=>{
    await reset();
    await db.exec('reset role');
    await db.exec(`alter table orders add column status text default 'pending',add column created_at timestamptz default now();
      alter table order_items add column product_name text,add column product_image_url text;
      insert into orders(id,user_id,payment_status,status) values('${order}','${customer}','verified','delivered');
      insert into order_items values('${order}','owned-game','Game title','/game.jpg');`);
    const migration=readFileSync(new URL('../supabase-public-profile.sql',import.meta.url),'utf8');
    await db.exec(migration);await db.exec(migration);
    await identity(customer);
    const settings=(await query('select shop_public_profile_settings() as s')).s;
    assert.equal(settings.enabled,false);assert.notEqual(settings.shareId,customer);
    const view=async()=> (await query('select shop_view_public_profile($1) as s',[settings.shareId])).s;
    const save=async(enabled,ids=['owned-game'],name='Public nickname')=>(await query('select shop_save_public_profile($1,$2,$3) as s',[enabled,ids,name])).s;
    assert.equal(await view(),null);
    await assert.rejects(save(true,['not-owned']),/GAME_NOT_OWNED/);
    await assert.rejects(save(true,['owned-game','owned-game']),/INVALID_PUBLIC_PROFILE/);
    await assert.rejects(save(true,Array(13).fill('owned-game')),/INVALID_PUBLIC_PROFILE/);
    await assert.rejects(save(true,[],''),/INVALID_PUBLIC_PROFILE/);
    await save(true);await identity('','anon');
    let publicData=await view();
    assert.deepEqual(Object.keys(publicData).sort(),['avatar','background','bio','displayName','games','rank'].sort());
    assert.equal(publicData.displayName,'Public nickname');assert.equal(publicData.rank,0);
    assert.deepEqual(publicData.games,[{id:'owned-game',name:'Game title',image:'/game.jpg'}]);
    await assert.rejects(db.query('select * from shop_public_profiles'),/permission denied/);
    await assert.rejects(db.query('select shop_public_profile_settings()'),/permission denied/);
    await assert.rejects(save(true),/permission denied/);
    await assert.rejects(db.query('select shop_public_rank($1)',[customer]),/permission denied/);
    await identity(other);await assert.rejects(save(true),/GAME_NOT_OWNED/);
    await save(false,[]);assert.equal((await view()).displayName,'Public nickname','other cannot revoke owner');
    await identity(admin);await adjust(501);
    await identity(customer);await query('select shop_set_rank_display(true)');
    await identity('','anon');assert.equal((await view()).rank,2);
    await db.exec('reset role');await db.exec("update orders set status='refunded'");
    await identity('','anon');assert.deepEqual((await view()).games,[],'refunded game is removed at read time');
    await identity(customer);await save(false,[]);await identity('','anon');assert.equal(await view(),null);
    await identity(customer);await save(true,[]);
    await db.exec('reset role');await db.exec(`update profiles set status='blocked' where id='${customer}'`);
    await identity('','anon');assert.equal(await view(),null,'blocked account is never public');
  });
  await t.test('username visits replace legacy sharing, keep private fields out and accept enum order status',async()=>{
    await db.exec('reset role');
    await db.exec(`alter table profiles add column username text;
      update profiles set username=case when id='${customer}' then 'PlayerOne' else 'PlayerTwo' end,status='active';
      update orders set status='delivered';
      create type test_order_status as enum ('delivered','waiting_admin','cancelled','expired');
      alter table orders alter column status drop default;
      alter table orders alter column status type test_order_status using status::test_order_status;`);
    await db.exec(`create table user_points(user_id uuid primary key,balance numeric);
      insert into user_points values('${customer}',27345),('${other}',777);
      insert into shop_wallets(user_id,balance) values('${customer}',79500) on conflict(user_id) do update set balance=excluded.balance;
      insert into order_items values('${order}','owned-game','Same game again','/game.jpg'),('${order}','second-game','Not selected','/second.jpg'),('${order}','point-topup','Topup',null);`);
    const sql=readFileSync(new URL('../supabase-member-profiles.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
    await identity(customer);
    await db.query('select shop_save_profile_showcase($1)',[['owned-game']]);
    assert.deepEqual((await query('select shop_profile_showcase_state() as s')).s.games,['owned-game']);
    await assert.rejects(db.query('select shop_save_profile_showcase($1)',[['not-owned']]),/GAME_NOT_OWNED/);
    await assert.rejects(db.query('select shop_save_profile_showcase($1)',[Array(13).fill('owned-game')]),/INVALID_GAMES/);
    await assert.rejects(db.query('select shop_public_profile_settings()'),/permission denied/);
    await identity('','anon');
    const visit=async name=>(await query('select shop_member_profile($1) as s',[name])).s;
    const p=await visit('playerone');assert.equal(p.displayName,'PlayerOne');assert.equal(p.games.length,1);
    assert.deepEqual(Object.keys(p).sort(),['displayName','avatar','background','bio','rank','games','stats'].sort());
    assert.deepEqual(p.stats,{purchasedGames:2,pointBalance:27345,shopPoints:79500});
    assert.equal(p.games.length,1,'purchase count is independent of the selected showcase');
    await identity(customer);await db.query('select shop_save_profile_showcase($1)',[[]]);
    await identity('','anon');assert.deepEqual((await visit('PlayerOne')).games,[],'zero selected games is respected');
    assert.equal((await visit('PlayerOne')).stats.purchasedGames,2,'hiding games does not alter purchased count');
    assert.equal(await visit(customer),null);assert.equal(await visit('missing'),null);
    assert.equal(await visit('PlayerTwo'),null,'ambiguous duplicate handles not exposed');
    await assert.rejects(db.query('select * from shop_profile_showcase'),/permission denied/);
    await assert.rejects(db.query('select * from user_points'),/permission denied/);
    await assert.rejects(db.query('select shop_profile_showcase_state()'),/permission denied/);
    await assert.rejects(db.query('select shop_save_profile_showcase($1)',[[]]),/permission denied/);
    await db.exec('reset role');await db.exec("update orders set status='cancelled'");
    await identity('','anon');assert.deepEqual((await visit('PlayerOne')).games,[]);
    assert.equal((await visit('PlayerOne')).stats.purchasedGames,0);
    await db.exec('reset role');await db.exec(`update profiles set status='banned' where id='${customer}'`);
    await identity('','anon');assert.equal(await visit('PlayerOne'),null);
  });
  await t.test('member search matches nickname and username with bounded safe public results',async()=>{
    await db.exec('reset role');
    await db.exec(`alter table profiles add column full_name text;
      update profiles set status='active',username=case id when '${customer}' then 'PlayerOne' when '${admin}' then 'PlayerAdmin' else 'PlayerOther' end,
      full_name=case id when '${other}' then 'โอลาฟ Snow' else 'น้องโอลาฟ' end;`);
    const sql=readFileSync(new URL('../supabase-member-search.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
    await identity('','anon');
    const search=async q=>(await query('select shop_search_members($1) as s',[q])).s;
    assert.equal((await search('PLAYERONE'))[0].username,'PlayerOne');
    const duplicateNickname=await search('น้องโอลาฟ');assert.equal(duplicateNickname.length,2);
    assert.deepEqual(Object.keys(duplicateNickname[0]).sort(),['avatar','nickname','username']);
    assert.equal((await search('โอลาฟ')).length,3);assert.equal((await search('snow'))[0].username,'PlayerOther');
    assert.deepEqual(await search(''),[]);assert.deepEqual(await search('  '),[]);assert.deepEqual(await search('%'),[]);assert.deepEqual(await search('_'),[]);
    assert.deepEqual(await search('a'.repeat(81)),[]);assert.deepEqual(await search("' OR true --"),[]);
    await db.exec('reset role');await db.exec(`update profiles set status='banned' where id='${admin}'`);
    await identity('','anon');assert.equal((await search('น้องโอลาฟ')).length,1);
    await db.exec('reset role');
    for(let i=0;i<14;i++){
      const id=`99000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
      await db.query('insert into profiles(id,username,full_name,status) values($1,$2,$3,$4)',[id,'Limit'+i,'Search limit','active']);
    }
    await identity('','anon');assert.equal((await search('limit')).length,10);assert.equal((await search('Limit13'))[0].username,'Limit13');
  });
  await t.test('friends require acceptance, restrict presence/activity and allow visits to active admin profiles',async()=>{
    await db.exec('reset role');
    await db.exec(`update profiles set status='active' where id in ('${customer}','${admin}','${other}');`);
    const sql=readFileSync(new URL('../supabase-friends.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
    const action=async(name,op)=>(await query('select shop_friend_action($1,$2) as s',[name,op])).s;
    const relation=async name=>(await query('select shop_friend_relation($1) as s',[name])).s;
    const list=async(kind='friends',offset=0)=>(await query('select shop_friends_list($1,$2) as s',[kind,offset])).s;
    const beat=async()=>(await query('select shop_friend_heartbeat() as s')).s;
    await identity(customer);
    assert((await query('select shop_member_profile($1) as s',['PlayerAdmin'])).s,'normal members can view admin profile');
    assert.equal((await relation('PlayerAdmin')).state,'none');assert.equal((await relation('PlayerAdmin')).online,null);
    await assert.rejects(action('PlayerOne','request'),/CANNOT_FRIEND_SELF/);
    assert.equal((await action('PlayerAdmin','request')).state,'outgoing');await action('PlayerAdmin','request');
    assert.equal((await list('outgoing')).length,1);
    await assert.rejects(action('PlayerAdmin','accept'),/NO_INCOMING_REQUEST/);
    await identity(admin);await beat();
    assert.equal((await relation('PlayerOne')).state,'incoming');assert.equal((await beat()).incoming,1);
    assert.equal((await action('PlayerOne','request')).state,'incoming','crossed requests do not auto-accept');
    await assert.rejects(action('PlayerOne','cancel'),/NO_OUTGOING_REQUEST/);
    await action('PlayerOne','accept');
    await identity(customer);assert.equal((await relation('PlayerAdmin')).state,'friends');assert.equal((await relation('PlayerAdmin')).online,true);
    assert.deepEqual(await list('activity'),[],'online activity before accepting is not shared');
    const friend=(await list())[0];assert.equal(friend.username,'PlayerAdmin');assert.equal(friend.online,true);
    assert.deepEqual(Object.keys(friend).sort(),['username','nickname','avatar','online'].sort());
    await identity(other);assert.equal((await relation('PlayerAdmin')).online,null);assert.deepEqual(await list(),[]);
    await assert.rejects(action('PlayerAdmin','remove'),/NOT_FRIENDS/);
    await db.exec('reset role');await db.exec(`update shop_friend_presence set seen_at=now()-interval '3 minutes' where user_id='${admin}'`);
    await identity(customer);assert.equal((await relation('PlayerAdmin')).online,false);
    await identity(admin);await beat();await beat();
    await identity(customer);assert.equal((await list('activity')).filter(e=>e.kind==='online').length,1,'heartbeat does not spam online notifications');
    const newOrder='ab000000-0000-4000-8000-000000000001';
    await db.exec('reset role');await db.exec(`insert into orders(id,user_id,payment_status,status) values('${newOrder}','${admin}','pending','waiting_admin')`);
    await identity(customer);assert.equal((await list('activity')).filter(e=>e.kind==='purchase').length,0);
    await db.exec('reset role');await db.exec(`update orders set payment_status='verified' where id='${newOrder}';update orders set status='delivered' where id='${newOrder}'`);
    await identity(customer);const purchases=(await list('activity')).filter(e=>e.kind==='purchase');assert.equal(purchases.length,1);
    assert.deepEqual(Object.keys(purchases[0]).sort(),['id','kind','createdAt','username','nickname'].sort());
    await assert.rejects(db.query('select * from shop_friend_presence'),/permission denied/);
    await assert.rejects(db.query('insert into shop_friend_events(actor_id,kind) values($1,$2)',[admin,'purchase']),/permission denied/);
    await assert.rejects(db.query('select shop_friend_target($1)',['PlayerAdmin']),/permission denied/);
    await action('PlayerAdmin','remove');assert.deepEqual(await list('activity'),[]);assert.equal((await relation('PlayerAdmin')).online,null);
    await action('PlayerAdmin','request');await action('PlayerAdmin','cancel');assert.equal((await relation('PlayerAdmin')).state,'none');
    await action('PlayerAdmin','request');await identity(admin);await action('PlayerOne','decline');
    await identity(customer);assert.equal((await relation('PlayerAdmin')).state,'none');
    await assert.rejects(list('friends',-1),/INVALID_FRIEND_LIST/);
    await identity('','anon');await assert.rejects(beat(),/permission denied/);await assert.rejects(list(),/permission denied/);await assert.rejects(action('PlayerAdmin','request'),/permission denied/);
  });
  await t.test('ssonx admin profile is visible to another customer and anonymous visitors without admin permissions',async()=>{
    await db.exec('reset role');await db.query("update profiles set username='ssonx',full_name='ADMIN',role='admin',status='active' where id=$1",[admin]);
    for(const [id,role] of [[customer,'authenticated'],['','anon']]){
      await identity(id,role);
      const viewed=(await query('select shop_member_profile($1) as s',['ssonx'])).s;
      assert.equal(viewed.displayName,'ssonx');assert(!Object.hasOwn(viewed,'email'));assert(!Object.hasOwn(viewed,'role'));
      const results=(await query('select shop_search_members($1) as s',['ssonx'])).s;
      assert.equal(results[0].username,'ssonx');assert.equal(results[0].nickname,'ADMIN');
      const byNickname=(await query('select shop_search_members($1) as s',['ADMIN'])).s;
      assert(byNickname.some(member=>member.username==='ssonx'),'admin is searchable by nickname without a shortcut');
      await assert.rejects(db.query('select * from profiles'),/permission denied/);
    }
    await identity(customer);await assert.rejects(adjust(),/ACCESS_DENIED/);
    await db.exec('reset role');await db.query("update profiles set status='banned' where id=$1",[admin]);
    await identity(customer);assert.equal((await query('select shop_member_profile($1) as s',['ssonx'])).s,null,'named shortcut cannot bypass suspension');
  });
  await t.test('legacy showcase imports reach visitor profiles without overwriting existing or empty selections',async()=>{
    await db.exec('reset role');
    await db.exec(`update profiles set status='active' where id='${customer}';update orders set status='delivered' where id='${order}';delete from shop_profile_showcase where user_id='${customer}';`);
    const sql=readFileSync(new URL('../supabase-profile-showcase-sync.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
    await identity(customer);
    const imported=(await query('select shop_import_profile_showcase($1) as s',[['second-game','owned-game','not-owned','point-topup','owned-game']])).s;
    assert.deepEqual(imported.games,['second-game','owned-game']);
    await identity('','anon');
    assert.deepEqual((await query('select shop_member_profile($1) as s',['PlayerOne'])).s.games.map(g=>g.id),['second-game','owned-game']);
    await assert.rejects(db.query('select shop_import_profile_showcase($1)',[['owned-game']]),/permission denied/);
    await identity(customer);await db.query('select shop_save_profile_showcase($1)',[[]]);
    assert.deepEqual((await query('select shop_import_profile_showcase($1) as s',[['owned-game']])).s.games,[]);
    await db.query('select shop_save_profile_showcase($1)',[['second-game']]);
    assert.deepEqual((await query('select shop_import_profile_showcase($1) as s',[['owned-game']])).s.games,['second-game']);
    await assert.rejects(db.query('select shop_import_profile_showcase($1)',[Array(13).fill('owned-game')]),/INVALID_GAMES/);
  });
  await t.test('read-only ssonx diagnostic reports real row eligibility and function permissions',async()=>{
    await db.exec('reset role');
    const result=(await db.query(readFileSync(new URL('../diagnose-ssonx-profile.sql',import.meta.url),'utf8'))).rows[0];
    const report=JSON.parse(result.diagnostic);
    assert.equal(report.exact_username_count,1);assert.equal(report.active_exact_username_count,0);
    assert.equal(report.candidate_profiles.find(p=>p.username==='ssonx').status,'banned');
    assert.equal(report.search_function.security_definer,true);assert.equal(report.search_function.anon_can_execute,true);
    assert(!result.diagnostic.includes('email'));assert(!result.diagnostic.includes(admin));
  });
  await t.test('duplicate usernames remain separately searchable and friend actions resolve the chosen public key',async()=>{
    await db.exec('reset role');
    await db.query("update profiles set username='ssonx',full_name=case when id=$1 then 'ADMIN' else 'ssonx' end,status='active' where id in ($1,$2)",[admin,other]);
    const fix=readFileSync(new URL('../supabase-member-duplicate-fix.sql',import.meta.url),'utf8');
    await db.exec(fix);
    await db.query("insert into shop_profile_decoration(user_id,bio) values($1,'Admin biography'),($2,'Customer biography') on conflict(user_id) do update set bio=excluded.bio",[admin,other]);
    await identity('','anon');
    const search=async name=>(await query('select shop_search_members($1) as s',[name])).s;
    const matches=await search('ssonx');assert.equal(matches.length,2);
    const adminKey=matches.find(p=>p.nickname==='ADMIN').profileKey;
    const otherKey=matches.find(p=>p.nickname==='ssonx').profileKey;
    assert.match(adminKey,/^~[0-9a-f-]{36}$/);assert.notEqual(adminKey,otherKey);
    assert(!JSON.stringify(matches).includes(admin));assert(!JSON.stringify(matches).includes(other));
    assert.equal((await search('ADMIN'))[0].profileKey,adminKey);
    assert.equal((await query('select shop_member_profile($1) as s',[adminKey])).s.bio,'Admin biography');
    assert.equal((await query('select shop_member_profile($1) as s',[otherKey])).s.bio,'Customer biography');
    assert.equal((await query('select shop_member_profile($1) as s',['ssonx'])).s,null,'ambiguous legacy links must not guess');
    for(const key of [adminKey,otherKey])assert.equal((await query('select shop_member_profile($1) as s',[key])).s.displayName,'ssonx');
    assert.equal((await query('select shop_member_profile($1) as s',[admin])).s,null,'auth ID is not a public handle');
    assert.equal((await query('select shop_member_profile($1) as s',['~invalid'])).s,null);
    await assert.rejects(db.query('select * from shop_member_handles'),/permission denied/);
    await assert.rejects(db.query('select shop_resolve_member($1)',[adminKey]),/permission denied/);
    await identity(customer);
    await db.query("select shop_friend_action($1,'request')",[adminKey]);
    assert.equal((await query('select shop_friend_relation($1) as s',[adminKey])).s.state,'outgoing');
    assert.equal((await query('select shop_friend_relation($1) as s',[otherKey])).s.state,'none');
    const outgoing=(await query("select shop_friends_list('outgoing',0) as s")).s;
    assert.equal(outgoing.find(p=>p.nickname==='ADMIN').profileKey,adminKey);
    await identity(admin);
    await db.query("select shop_friend_action('PlayerOne','accept')");
    await identity(customer);
    assert.equal((await query('select shop_friend_relation($1) as s',[adminKey])).s.state,'friends');
    await db.exec('reset role');await db.exec(fix);
    assert.equal((await query('select shop_member_profile_key($1) as s',[admin])).s,adminKey,'rerun keeps links stable');
    await db.query("update profiles set username='renamed-admin' where id=$1",[admin]);
    assert.equal((await query('select shop_member_profile($1) as s',[adminKey])).s.displayName,'renamed-admin');
    await db.query("update profiles set status='banned' where id=$1",[admin]);
    await identity(customer);
    assert.equal((await query('select shop_member_profile($1) as s',[adminKey])).s,null);
    await assert.rejects(db.query('select shop_friend_relation($1)',[adminKey]),/MEMBER_NOT_FOUND/);
    assert.equal((await search('ADMIN')).length,0);
    await db.exec('reset role');
    const fresh='77777777-7777-4777-8777-777777777777';
    await db.query("insert into profiles(id,username,full_name,status) values($1,'NewHandle','New member','active')",[fresh]);
    assert.match((await query('select shop_member_profile_key($1) as s',[fresh])).s,/^~/,'new profiles get a public key automatically');
  });
  await t.test('lifetime levels count verified cash once, cross months and expose only level progress',async()=>{
    await db.exec('reset role');
    const member='88888888-8888-4888-8888-888888888888';
    await db.query('insert into auth.users(id) values($1)',[member]);
    await db.query("insert into profiles(id,username,full_name,role,status) values($1,'LevelTest','Level Test','customer','active')",[member]);
    const sql=readFileSync(new URL('../supabase-profile-level.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
    const handle=(await query('select shop_member_profile_key($1) as k',[member])).k;
    const state=async()=>(await query('select shop_my_level() as s')).s;
    await identity(member);assert.deepEqual(await state(),{level:0,progress:0,step:100});
    await db.exec('reset role');let seq=0;
    const paid=async(amount,tx,status='delivered',payment='verified',verification='verified')=>{
      const id='99999999-9999-4999-8999-'+String(++seq).padStart(12,'0');
      await db.query('insert into orders(id,user_id,payment_status,status,created_at) values($1,$2,$3,$4,now()-interval \'2 years\')',[id,member,payment,status]);
      await db.query("insert into payment_verifications(id,order_id,user_id,status,provider,provider_transaction_id,verified_amount,created_at) values(gen_random_uuid(),$1,$2,$3,'rdcw',$4,$5,now()-interval '2 years')",[id,member,verification,tx,amount]);
      return id;
    };
    const first=await paid(99.99,'level-tx-one');await identity(member);assert.equal((await state()).level,0);assert.equal((await state()).progress,99.99);
    await db.exec('reset role');await paid(.01,'level-tx-two');await identity(member);assert.deepEqual(await state(),{level:1,progress:0,step:100});
    await db.exec('reset role');await paid(150.5,'level-tx-three');await paid(150.5,'level-tx-three');
    await db.query("insert into payment_verifications(id,order_id,user_id,status,provider,provider_transaction_id,verified_amount) values(gen_random_uuid(),$1,$2,'verified','rdcw','level-tx-one',99.99)",[first,member]);
    await paid(500,'cancelled-cash','cancelled');await paid(500,'unverified-order','delivered','pending');await paid(500,'rejected-slip','delivered','verified','rejected');await paid(500,'');
    await db.query("insert into user_points(user_id,balance) values($1,99999)",[member]);
    await identity(member);assert.deepEqual(await state(),{level:2,progress:50.5,step:100},'Point balance and duplicate slips do not inflate lifetime levels');
    await identity('','anon');assert.deepEqual((await query('select shop_member_level($1) as s',[handle])).s,{level:2,progress:50.5,step:100});
    await assert.rejects(db.query('select shop_my_level()'),/permission denied/);
    await assert.rejects(db.query('select shop_level_data($1)',[member]),/permission denied/);
    assert.equal((await query('select shop_member_level($1) as s',[member])).s,null);
    await db.exec('reset role');await db.query("update profiles set status='banned' where id=$1",[member]);
    await identity('','anon');assert.equal((await query('select shop_member_level($1) as s',[handle])).s,null);
  });
  await db.close();
});
