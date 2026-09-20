import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import handler, { scanAvatarCatalog, scanBackgroundCatalog, backgroundFolderPrice } from '../api/profile-shop.js';

test('background folders determine price and sort low to high, ignoring unsafe paths and unknown tiers', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(),'olaf-background-catalog-'));
  try {
    for (const tier of ['1.5k','20k','100k','invalid']) {
      const folder=path.join(root,'iconprofile/BGolaf/BGpoint',tier);
      await mkdir(folder,{recursive:true}); await writeFile(path.join(folder,'cover.webp'),'fixture');
    }
    await writeFile(path.join(root,'iconprofile/BGolaf/free.png'),'fixture');
    const result=await scanBackgroundCatalog(root);
    assert.deepEqual(result.map(item=>item.price),[0,1500,20000,100000]);
    assert(result.every(item=>item.kind==='background'));
    assert.equal(backgroundFolderPrice('../20k'),null);
    assert.equal(backgroundFolderPrice('1e5'),null);
    assert.equal(backgroundFolderPrice('0'),null);
    assert.equal(backgroundFolderPrice('8.5k'),8500);
  } finally { await rm(root,{recursive:true,force:true}); }
});

function response() {
  return { headers:{}, code:0, body:null, setHeader(k,v){ this.headers[k]=v; }, status(code){ this.code=code; return this; }, json(body){ this.body=body; return this; } };
}
test('catalog reads real files, keeps free and paid groups separate and sorts numerically', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(),'olaf-avatar-catalog-'));
  try {
    await mkdir(path.join(root,'iconprofile/iconpoint'),{ recursive:true });
    for (const file of ['10.png','02.png','01.png','note.txt']) await writeFile(path.join(root,'iconprofile',file),'fixture');
    await writeFile(path.join(root,'iconprofile/iconpoint/01.png'),'fixture');
    const catalog = await scanAvatarCatalog(root);
    assert.deepEqual(catalog.map(p=>p.id),['iconprofile/01.png','iconprofile/02.png','iconprofile/10.png','iconprofile/iconpoint/01.png']);
    assert.deepEqual(catalog.map(p=>p.price),[0,0,0,1000]);
    await writeFile(path.join(root,'iconprofile/03.png'),'fixture');
    assert.equal((await scanAvatarCatalog(root))[2].id,'iconprofile/03.png','new image appears without editing manifest');
  } finally { await rm(root,{ recursive:true,force:true }); }
});
test('current folder contains 7 free and 5 paid originals', async () => {
  const catalog = await scanAvatarCatalog();
  assert.equal(catalog.filter(p=>p.price===0).length,7);
  assert.equal(catalog.filter(p=>p.price===1000).length,5);
});
test('public catalog works without credentials and uses no-store', async () => {
  const res = response(); await handler({ method:'GET' },res);
  assert.equal(res.code,200); assert.equal(res.body.catalog.length,12);
  assert.equal(res.headers['Cache-Control'],'no-store');
});
test('API rejects unsupported methods', async () => {
  const res = response(); await handler({ method:'DELETE' },res);
  assert.equal(res.code,405);
});
test('API validates identity and real file, derives price and delegates atomic purchase with user token', async () => {
  const saved = { url:process.env.SUPABASE_URL, key:process.env.SUPABASE_PUBLISHABLE_KEY, service:process.env.SUPABASE_SERVICE_ROLE_KEY, fetch:globalThis.fetch };
  process.env.SUPABASE_URL='https://database.example'; process.env.SUPABASE_PUBLISHABLE_KEY='public-test'; process.env.SUPABASE_SERVICE_ROLE_KEY='service-test';
  try {
    const calls=[];
    globalThis.fetch=async(url,options)=>{ calls.push({url,...options}); return {ok:true,json:async()=>({ balance:0, owned:['iconprofile/iconpoint/01.png'] })}; };
    const noauth=response(); await handler({ method:'POST',headers:{},body:{} },noauth);
    assert.equal(noauth.code,401); assert.equal(calls.length,0);
    const invalid=response(); await handler({method:'POST',headers:{authorization:'Bearer user-test'},body:{action:'purchase',avatarId:'../secret'}},invalid);
    assert.equal(invalid.code,404); assert.equal(calls.length,1);
    calls.length=0;
    const res=response(); await handler({method:'POST',headers:{authorization:'Bearer user-test'},body:{action:'purchase',avatarId:'iconprofile/iconpoint/01.png',price:0,userId:'victim'}},res);
    assert.equal(res.code,200);
    assert.equal(calls.length,3);
    assert.deepEqual(JSON.parse(calls[1].body),{p_id:'iconprofile/iconpoint/01.png',p_path:'iconprofile/iconpoint/01.png'});
    assert.equal(calls[1].headers.Authorization,'Bearer service-test');
    assert.deepEqual(JSON.parse(calls[2].body),{p_avatar:'iconprofile/iconpoint/01.png'});
    assert.equal(calls[2].headers.Authorization,'Bearer user-test');
    // PostgREST returns 204 for RETURNS void, not a JSON object.
    // This is the registration response used in production before saving a profile.
    calls.length=0;
    globalThis.fetch=async(url,options)=>{
      calls.push({url,...options});
      if (url.endsWith('/shop_register_avatar')) return new Response(null,{status:204});
      return Response.json({balance:0,owned:[],equipped:'iconprofile/01.png',ledger:[]});
    };
    const savedAvatar=response();
    await handler({method:'POST',headers:{authorization:'Bearer user-test'},body:{action:'equip',avatarId:'iconprofile/01.png'}},savedAvatar);
    assert.equal(savedAvatar.code,200,'void registration success must proceed to equip instead of JSON parsing failure');
    assert.equal(calls.length,3);
    assert.equal(savedAvatar.body.state.equipped,'iconprofile/01.png');
  } finally {
    for (const [key,value] of [['SUPABASE_URL',saved.url],['SUPABASE_PUBLISHABLE_KEY',saved.key],['SUPABASE_SERVICE_ROLE_KEY',saved.service]]) {
      if (value===undefined) delete process.env[key]; else process.env[key]=value;
    }
    globalThis.fetch=saved.fetch;
  }
});
