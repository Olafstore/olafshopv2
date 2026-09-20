import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('hero save preserves other settings and only commits after successful admin save',async()=>{
  const source=read('admin.js');
  const body=source.slice(source.indexOf('async function saveHeroBackground()'),source.indexOf('function renderDataPreview()',source.indexOf('async function saveHeroBackground()')));
  for(const fail of [false,true]) {
    let saved;
    const nodes={};
    const ctx=vm.createContext({pendingHeroBackground:'data:image/webp;base64,new',document:{getElementById:id=>nodes[id]??=( {disabled:false,textContent:''})},state:{payload:{store:{}}},window:{OlafStoreSettings:{fetchStoreSettings:async()=>saved || ({siteIconUrl:'logo.png',payment:{note:'retain'}})}},saveOnlineStoreSettings:async settings=>{ if(fail) throw new Error('denied'); saved=settings; }});
    vm.runInContext(body,ctx); await ctx.saveHeroBackground();
    assert.equal(nodes['save-hero-background'].disabled,false);
    if(fail) { assert.equal(ctx.state.payload.store.heroBackgroundUrl,undefined); assert(nodes['hero-background-status'].textContent.includes('denied')); }
    else { assert.equal(saved.siteIconUrl,'logo.png'); assert.equal(saved.payment.note,'retain'); assert.equal(saved.heroBackgroundUrl,'data:image/webp;base64,new'); }
  }
});
test('brand logo is converted to a compact PNG favicon and hero uses admin settings',()=>{
  const source=read('site-navigation.js');
  assert(source.includes('canvas.width = canvas.height = 64'));
  assert(source.includes("canvas.toDataURL('image/png')"));
  assert(read('app.js').includes('applyHomeHeroBackground(state.store.heroBackgroundUrl)'));
  for(const file of ['app.js','product.js']) assert(read(file).includes('window.OlafApplyFavicon(iconUrl)'));
});

test('home hero swaps only after load and stale requests cannot replace the latest image',()=>{
  const source=read('app.js');
  const images=[]; let replaced;
  const current={dataset:{},isConnected:true,replaceChildren:next=>{replaced=next;}};
  const ctx=vm.createContext({document:{querySelector:()=>current},Image:class{constructor(){images.push(this);}},console});
  vm.runInContext(source.slice(source.indexOf('function applyHomeHeroBackground('),source.indexOf('function renderAll()')),ctx);
  ctx.applyHomeHeroBackground('first.png'); ctx.applyHomeHeroBackground('latest.png');
  assert.equal(replaced,undefined);
  images[0].onload(); assert.equal(replaced,undefined);
  images[1].onload(); assert.equal(replaced.src,'latest.png');
  ctx.applyHomeHeroBackground(''); assert.equal(replaced,undefined);
  assert(!read('index.html').includes('https://files.catbox.moe/q8ywqr.png'));
  ctx.applyHomeHeroBackground('failed.png');
  assert.equal(replaced,undefined);
  assert(source.includes('fetchStoreSettings({ forceRefresh: true })'));
});
test('hero upload validates size/type and has separate non-submit save control',()=>{
  const source=read('admin.js'), html=read('olaf-control.html');
  assert(source.includes('file.size > 8 * 1024 * 1024'));
  assert(source.includes("canvas.toDataURL('image/webp',.82)"));
  assert(html.includes('id="save-hero-background" class="primary-button" type="button"'));
  assert(html.includes('id="hero-background-status" role="status"'));
});
