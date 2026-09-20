import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {sanitizeChatImage} from '../api/friend-image.js';
const require=createRequire(`${process.env.PGLITE_TEST_ROOT||process.cwd()}/package.json`);
const {PGlite}=await import(pathToFileURL(require.resolve('@electric-sql/pglite')).href);
test('chat image sanitizer rejects renamed files, SVG, WebP, MIME mismatches and broken bytes',async()=>{
 const source=sharp({create:{width:16,height:16,channels:3,background:'#f00'}});
 const png=await source.clone().png().toBuffer(),jpg=await source.clone().jpeg().toBuffer(),webp=await source.clone().webp().toBuffer();
 for(const [bytes,mime,name] of [[png,'image/png','one.png'],[jpg,'image/jpeg','one.jpg']]){
  const out=await sanitizeChatImage(bytes.toString('base64'),mime,name);assert.equal((await sharp(Buffer.from(out,'base64')).metadata()).format,'jpeg');
 }
 for(const [bytes,mime,name] of [[webp,'image/png','fake.png'],[png,'image/jpeg','fake.jpg'],[Buffer.from('<svg onload="bad()"/>'),'image/png','x.png'],[jpg,'image/jpeg','x.exe'],[Buffer.from([255,216,255,...Array(40).fill(0)]),'image/jpeg','broken.jpg']])await assert.rejects(()=>sanitizeChatImage(bytes.toString('base64'),mime,name));
 await assert.rejects(()=>sanitizeChatImage('A'.repeat(2800001),'image/png','huge.png'));
});
test('database enforces accepted friendship, participant privacy, server-only image writes and idempotency',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',c='00000000-0000-4000-8000-000000000003',nonce='10000000-0000-4000-8000-000000000001';
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);
 create table profiles(id uuid,username text,full_name text,status text);create table shop_equipped_avatars(user_id uuid,avatar_id text);
 create table shop_friendships(user_low uuid,user_high uuid,state text);
 create function shop_assert_member() returns uuid language plpgsql as $$ declare u uuid:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;begin if u is null then raise exception 'AUTH_REQUIRED';end if;return u;end $$;
 create function shop_friend_target(n text) returns uuid language sql as $$select id from profiles where username=n and status='active'$$;
 insert into auth.users values('${a}'),('${b}'),('${c}');insert into profiles values('${a}','Alice','Alice','active'),('${b}','Bob','Bob','active'),('${c}','Carol','Carol','active');
 insert into shop_friendships values('${a}','${b}','accepted');`);
 await db.exec(readFileSync(new URL('../supabase-friends-chat-v257.sql',import.meta.url),'utf8'));
 const login=id=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
 await login(a);await db.exec('set role authenticated');
 const send=()=>db.query('select shop_friend_message_send($1,$2,$3) as result',['Bob','<img src=x onerror=alert(1)>',nonce]);
 const first=(await send()).rows[0].result;assert.deepEqual((await send()).rows[0].result,first);
 await assert.rejects(()=>db.query('select shop_friend_message_send($1,$2,$3)',['Carol','hi',nonce]),/CHAT_FRIENDS_ONLY/);
 await assert.rejects(()=>db.query('select shop_friend_message_send($1,$2,$3)',['Bob',' ',nonce]),/CHAT_INVALID_TEXT/);
 await assert.rejects(()=>db.query('select shop_friend_message_send($1,$2,$3)',['Bob','different',nonce]),/CHAT_NONCE_CONFLICT/);
 await assert.rejects(()=>db.query('select * from shop_friend_messages'),/permission denied/);
 await assert.rejects(()=>db.query('select shop_friend_image_send($1,$2,$3,$4)',[a,'Bob','/9j/AAAA',nonce]),/permission denied/);
 assert.equal((await db.query("select shop_friend_suggestions() as r")).rows[0].r[0].username,'Carol');
 await login(b);const messages=(await db.query("select shop_friend_messages_list('Alice') as r")).rows[0].r;assert.equal(messages[0].body,'<img src=x onerror=alert(1)>');assert.equal(messages[0].mine,false);
 await login(c);await assert.rejects(()=>db.query("select shop_friend_messages_list('Alice')"),/CHAT_FRIENDS_ONLY/);
 await db.exec('reset role');await login(a);
 const image=(await db.query('select shop_friend_image_send($1,$2,$3,$4) as r',[a,'Bob','/9j/AAAA','20000000-0000-4000-8000-000000000001'])).rows[0].r;
 await db.exec('set role authenticated');await login(b);assert.equal((await db.query('select shop_friend_image_read($1) as r',[image.id])).rows[0].r,'/9j/AAAA');
 await login(c);await assert.rejects(()=>db.query('select shop_friend_image_read($1)',[image.id]),/CHAT_IMAGE_UNAVAILABLE/);
 await db.exec("reset role;update shop_friendships set state='pending'");await login(a);await db.exec('set role authenticated');await assert.rejects(()=>db.query("select shop_friend_messages_list('Bob')"),/CHAT_FRIENDS_ONLY/);
});
