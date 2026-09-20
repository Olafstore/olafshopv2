import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const segment=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
test('tag filtering matches exact tags, not names or partial tag names',()=>{
  const state={products:[{id:'a',name:'One',tags:['Action'],stock:1},{id:'b',name:'Action',tags:['Action RPG'],stock:1},{id:'c',name:'Three',tags:['Action'],stock:0}],selectedTag:'action',selectedCategory:'all',query:'',stockOnly:false,sortBy:'default'};
  const ctx=vm.createContext({state,normalizeCatalogSearch:v=>String(v||'').toLowerCase(),getDisplayTags:p=>p.tags,steamEditorialShuffle:p=>p});
  vm.runInContext(segment('function filteredProducts()', 'async function loadProducts()'),ctx);
  assert.deepEqual(Array.from(ctx.filteredProducts(),p=>p.id),['a','c']);
  state.stockOnly=true; assert.deepEqual(Array.from(ctx.filteredProducts(),p=>p.id),['a']);
  state.selectedTag='unknown'; assert.equal(ctx.filteredProducts().length,0);
  state.selectedTag=''; assert.equal(ctx.filteredProducts().length,2);
});
test('sidebar counts each product once per real tag and renders encoded links',()=>{
  const target={innerHTML:''};
  const ctx=vm.createContext({document:{getElementById:()=>target},state:{selectedTag:'RPG',products:[{tags:['RPG','RPG']},{tags:['RPG','A&B']},{tags:['RPG'],status:'inactive'}]},translateTagToThai:v=>v,normalizeCatalogSearch:v=>String(v||'').toLowerCase(),escapeHtml:v=>String(v).replaceAll('&','&amp;')});
  vm.runInContext(segment('function renderTagCategories()', 'function categoryLayerProducts('),ctx);
  ctx.renderTagCategories();
  assert(target.innerHTML.includes('<strong>2</strong>'));
  assert(target.innerHTML.includes('?tag=A%26B#catalog'));
  assert(target.innerHTML.includes('aria-current="true"'));
  assert(target.innerHTML.includes('href="index.html#catalog"'));
});
test('product detail tags link to the same tag catalog',()=>{
  const product=fs.readFileSync(new URL('../product.js',import.meta.url),'utf8');
  assert(product.includes('<a class="pd-genre-tag" href="index.html?tag=${encodeURIComponent(t)}#catalog">'));
  assert(!source.includes('<a class="catalog-genre-game"'));
});

test('product tag popup lists exact matches without navigating away',()=>{
  const product=fs.readFileSync(new URL('../product.js',import.meta.url),'utf8');
  const dialog={innerHTML:'',open:false,showModal(){this.open=true;}};
  const ctx=vm.createContext({document:{getElementById:()=>dialog},globalPayload:{products:[{id:'yes',name:'Game',price:49,compareAt:590,stock:1,tags:['Action']},{id:'no',name:'Other',tags:['Action RPG']}]},cleanDisplayText:v=>String(v||''),escapeHtml:v=>String(v||''),getDisplayTags:p=>p.tags});
  const start=product.indexOf('function showProductTagResults(');
  vm.runInContext(product.slice(start,product.indexOf("document.addEventListener('click'",start)),ctx);
  ctx.showProductTagResults('Action');
  assert(dialog.open);
  assert(dialog.innerHTML.includes('product.html?id=yes'));
  assert(dialog.innerHTML.includes('-92%'));
  assert(dialog.innerHTML.includes('<del>฿590</del>'));
  assert(dialog.innerHTML.includes('พร้อมส่ง 1 ชิ้น'));
  assert(dialog.innerHTML.includes('<article class="tag-results-game">'));
  assert(!dialog.innerHTML.includes('<a class="tag-results-game"'));
  assert(dialog.innerHTML.includes('<a class="pd-genre-tag" href="index.html?tag=Action#catalog">Action</a>'));
  assert.equal(dialog.scrollTop, 0);
  assert(!dialog.innerHTML.includes('product.html?id=no'));
  ctx.showProductTagResults('Unknown');
  assert(dialog.innerHTML.includes('ไม่พบเกมในแท็กนี้'));
  assert(source.includes("window.history.pushState(null, '', url.href)"));
});

test('popup cards cap tags at four and encode tag links safely',()=>{
  const product=fs.readFileSync(new URL('../product.js',import.meta.url),'utf8');
  const dialog={innerHTML:'',open:true};
  const ctx=vm.createContext({document:{getElementById:()=>dialog},globalPayload:{products:[{id:'one',name:'Game',tags:['Action','A&B','<Test>','Sports','Extra']}]},cleanDisplayText:v=>String(v||''),escapeHtml:v=>String(v||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),getDisplayTags:p=>p.tags});
  const start=product.indexOf('function showProductTagResults(');
  vm.runInContext(product.slice(start,product.indexOf("document.addEventListener('click'",start)),ctx);
  ctx.showProductTagResults('Action');
  assert.equal((dialog.innerHTML.match(/class="pd-genre-tag"/g)||[]).length,4);
  assert(dialog.innerHTML.includes('tag=A%26B#catalog'));
  assert(dialog.innerHTML.includes('&lt;Test&gt;'));
  assert(!dialog.innerHTML.includes('>Extra</a>'));
});

test('reload clears tag/category but direct navigation preserves shared tag links',()=>{
  for(const type of ['reload','navigate','back_forward']) {
    let updated='';
    const ctx=vm.createContext({URL,window:{performance:{getEntriesByType:()=>[{type}]},location:{href:'https://example.com/index.html?tag=Action&category=offline#catalog'},history:{replaceState:(_a,_b,url)=>updated=url}}});
    vm.runInContext(segment('function resetTagOnReload()', 'function applySearchFromUrl()'),ctx);
    if(type==='reload') { assert(!updated.includes('tag=')); assert(!updated.includes('category=')); }
    else assert.equal(updated,'');
  }
});

test('tag UI has sticky dismiss control, single result rows and collapsible categories',()=>{
  const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert(css.includes('.tag-results-head { position:sticky; top:0;'));
  assert(css.includes('.tag-results-dialog .tag-results-grid { grid-template-columns:minmax(0,1fr);'));
  assert(html.includes('<details class="panel-block catalog-tag-panel"'));
  assert(html.includes('id="open-tag-panel"'));
  assert(source.includes("document.querySelector('#catalog-products-heading')?.scrollIntoView"));
});
