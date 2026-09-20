import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
const require = createRequire(`${process.env.PGLITE_TEST_ROOT || process.cwd()}/package.json`);
const { Window } = await import(pathToFileURL(require.resolve('happy-dom')).href);
const source = readFileSync(new URL('../profile-shop.js', import.meta.url),'utf8');

test('profile atelier interactions use server balances, confirmation, inventory and explicit save', async t => {
  const window = new Window({ url:'https://shop.example/profile.html#avatar-shop', settings:{ disableCSSFileLoading:true, disableJavaScriptFileLoading:true, disableComputedStyleRendering:true } });
  t.after(() => window.happyDOM.close());
  window.document.body.innerHTML = '<div id="avatar-shop-root"></div>';
  const free = { id:'iconprofile/01.png', name:'01', image:'free.png', price:0 };
  const paid = { id:'iconprofile/iconpoint/01.png', name:'01', image:'paid.png', price:1000 };
  let state = { balance:1000, owned:[], equipped:null, ledger:[] };
  const calls = [];
  const user = { id:'member', displayName:'Member' };
  window.OlafStore = { ready:Promise.resolve(), currentUser:()=>user, refreshCurrentUser:async()=>user };
  window.olafSupabase = {
    rpc:async()=>({ data:structuredClone(state) }),
    auth:{ getSession:async()=>({ data:{ session:{ access_token:'fake-test-token' } } }) },
    channel:()=>({ on(){ return this; }, subscribe(){} }), removeChannel(){}
  };
  window.fetch = async (_url, options={}) => {
    if (options.method !== 'POST') return { ok:true, json:async()=>({ catalog:[free,paid] }) };
    const body = JSON.parse(options.body); calls.push(body);
    if (body.action === 'purchase') state = { ...state, balance:0, owned:[paid.id] };
    if (body.action === 'equip') state = { ...state, equipped:body.avatarId };
    return { ok:true, json:async()=>({ state:structuredClone(state) }) };
  };
  window.eval(source);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  const flush = async () => { for (let i=0;i<40;i++) await Promise.resolve(); };
  await flush();
  const root = window.document.getElementById('avatar-shop-root');
  assert.equal(root.querySelectorAll('.atelier-portrait').length,1);
  root.querySelector('[data-shop-tab="shop"]').click();
  root.querySelector(`[data-avatar="${paid.id}"]`).click();
  window.document.querySelector('[data-save]').click();
  assert.equal(calls.length,0,'opening confirmation must not debit anything');
  const dialog = window.document.querySelector('dialog');
  assert.equal(dialog.open,true);
  dialog.querySelector('[data-confirm]').click();
  await flush();
  assert.equal(calls.length,1);
  assert.deepEqual(Object.keys(calls[0]).sort(),['action','avatarId'],'no user ID/price/points sent by browser');
  assert.equal(root.querySelectorAll('.atelier-portrait').length,2,'purchase enters inventory');
  assert.equal(root.querySelector('.atelier-wallet strong').textContent,'0');
  assert.equal(state.equipped,null,'purchase does not silently equip');
  root.querySelector('[data-shop-action="equip"]').click();
  dialog.querySelector('[data-save]').click();
  await flush();
  assert.equal(state.equipped,paid.id);
  assert(root.querySelector('.atelier-status').textContent.includes('บันทึก'));
  assert.equal(root.querySelector('.atelier-save').disabled,true);
  await window.happyDOM.close();
});

test('background tiers preview, cancel, purchase and save without replacing equipped avatar', async t => {
  const window = new Window({url:'https://shop.example/profile-store.html',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true,disableComputedStyleRendering:true}});
  t.after(()=>window.happyDOM.close());
  window.document.body.innerHTML='<div id="avatar-shop-root"></div>';
  const free={id:'free-bg',name:'Free',kind:'background',image:'free.webp',price:0};
  const paid={id:'paid-bg',name:'Paid',kind:'background',image:'paid.webp',price:1500};
  const expensive={id:'expensive-bg',name:'Premium',kind:'background',image:'premium.webp',price:20000};
  const avatar={id:'avatar',name:'Avatar',image:'avatar.webp',price:0};
  let state={balance:2000,owned:[],backgroundOwned:[],equipped:'avatar',background:null,ledger:[]};
  const calls=[];
  const user={id:'member',displayName:'Member',avatarUrl:'avatar.webp'};
  window.OlafStore={ready:Promise.resolve(),currentUser:()=>user,refreshCurrentUser:async()=>user};
  window.olafSupabase={rpc:async()=>({data:structuredClone(state)}),auth:{getSession:async()=>({data:{session:{access_token:'test'}}})},channel:()=>({on(){return this;},subscribe(){}}),removeChannel(){}};
  window.fetch=async(_url,options={})=>{
    if(options.method!=='POST') return {ok:true,json:async()=>({catalog:[avatar,expensive,free,paid]})};
    const body=JSON.parse(options.body); calls.push(body);
    if(body.action==='purchase') state={...state,balance:500,backgroundOwned:[paid.id]};
    else state={...state,background:body.avatarId};
    return {ok:true,json:async()=>({state:structuredClone(state)})};
  };
  window.eval(source); window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  const flush=async()=>{for(let i=0;i<50;i++) await Promise.resolve();}; await flush();
  const root=window.document.getElementById('avatar-shop-root');
  root.querySelector('[data-shop-kind="background"]').click();
  assert.equal(root.querySelectorAll('.atelier-portrait').length,1);
  root.querySelector('[data-shop-tab="shop"]').click();
  assert.deepEqual(Array.from(root.querySelectorAll('[data-avatar]'),p=>p.dataset.avatar),['paid-bg','expensive-bg']);
  root.querySelector('[data-avatar="expensive-bg"]').click();
  const dialog=window.document.querySelector('dialog');
  assert.equal(dialog.querySelector('[data-save]').disabled,true);
  dialog.querySelector('[data-cancel]').click();
  assert.equal(calls.length,0);
  root.querySelector('[data-avatar="paid-bg"]').click();
  assert(dialog.querySelector('.decoration-preview-bg'));
  dialog.querySelector('[data-save]').click();
  assert(dialog.textContent.includes('1,500'));
  dialog.querySelector('[data-confirm]').click(); await flush();
  assert.equal(state.balance,500); assert.equal(state.background,null);
  root.querySelector('[data-shop-action="equip"]').click(); dialog.querySelector('[data-save]').click(); await flush();
  assert.equal(state.background,'paid-bg'); assert.equal(state.equipped,'avatar');
  assert.deepEqual(calls.map(call=>call.action),['purchase','equip']);
});

test('standalone market shows real cards, search, categories, sorting and purchase preview',async t=>{
  const window=new Window({url:'https://shop.example/profile-store.html',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
  t.after(()=>window.happyDOM.close());
  window.document.body.className='profile-store-page';
  window.document.body.innerHTML='<div id="avatar-shop-root"></div>';
  const user={id:'member',displayName:'Member'};
  const catalog=[{id:'a',name:'Alpha',price:0,image:'a.png'},{id:'b',name:'Beta',price:1500,kind:'background',image:'b.png'}];
  window.OlafStore={ready:Promise.resolve(),currentUser:()=>user,refreshCurrentUser:async()=>user};
  window.olafSupabase={rpc:async()=>({data:{balance:2000,owned:[],ledger:[]}}),channel:()=>({on(){return this;},subscribe(){}}),removeChannel(){}};
  window.fetch=async()=>({ok:true,json:async()=>({catalog})});
  window.eval(source);window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  for(let i=0;i<40;i++) await Promise.resolve();
  const root=window.document.getElementById('avatar-shop-root');
  assert.equal(root.querySelectorAll('.store-product-grid [data-avatar]').length,2);
  assert.equal(root.querySelectorAll('.store-featured-track [data-avatar]').length,2);
  root.querySelector('[data-shop-kind="background"]').click();
  assert.equal(root.querySelectorAll('.store-product-grid [data-avatar]').length,1);
  root.querySelector('.store-product-grid [data-avatar]').click();
  assert(window.document.querySelector('.decoration-preview-bg'));
  window.document.querySelector('[data-cancel]').click();
  root.querySelector('[data-shop-kind="all"]').click();
  const form=root.querySelector('[data-store-search]');form.elements.query.value='Alpha';
  form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(root.querySelectorAll('.store-product-grid [data-avatar]').length,1);
  assert.equal(root.querySelector('.store-product-grid [data-avatar]').dataset.avatar,'a');
  root.querySelector('[data-store-random]').click();
  assert.equal(root.querySelector('[data-store-sort]').value,'random',root.querySelector('[data-store-sort]').outerHTML);
});

test('mobile design and navigation expose a dedicated shop panel without product-card layout', () => {
  const html = readFileSync(new URL('../profile.html',import.meta.url),'utf8');
  const css = readFileSync(new URL('../profile-shop.css',import.meta.url),'utf8');
  assert(html.includes('href="profile-store.html"'));
  assert(html.includes('id="panel-overview"'));
  assert(css.includes('@media(max-width:600px)'));
  assert(css.includes('repeat(3,minmax(0,1fr))'));
  assert(css.includes('prefers-reduced-motion'));
  assert(!source.includes('product-card'));
});

test('wallet RPC error preserves catalog and reports the actual database code, even after switching tabs', async () => {
  const window = new Window({ url:'https://shop.example/profile.html#avatar-shop', settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true} });
  window.document.body.innerHTML='<div id="avatar-shop-root"></div>';
  window.OlafStore={ready:Promise.resolve(),currentUser:()=>({id:'test'})};
  window.olafSupabase={rpc:async()=>({error:{code:'42501',message:'permission denied'}}),channel:()=>({on(){return this;},subscribe(){}})};
  window.fetch=async()=>({ok:true,status:200,json:async()=>({catalog:[{id:'iconprofile/01.png',name:'01',image:'01.png',price:0}]})});
  window.eval(source);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  for(let i=0;i<20;i++) await Promise.resolve();
  const root=window.document.getElementById('avatar-shop-root');
  assert.equal(root.querySelectorAll('.atelier-portrait').length,1);
  assert(root.querySelector('.atelier-status').textContent.includes('shop_decoration_state / 42501'));
  assert(root.querySelector('.atelier-status').textContent.includes('SHOP_DATABASE_PERMISSION'));
  assert.equal(root.querySelector('.atelier-save').disabled,true);
  root.querySelector('[data-shop-tab="shop"]').click();
  assert(root.querySelector('.atelier-status').textContent.includes('42501'));
  await window.happyDOM.close();
});
