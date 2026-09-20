import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const segment=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const products=JSON.parse(fs.readFileSync(new URL('../api/products.json',import.meta.url),'utf8')).products;
function setup(seed=42) {
  const context=vm.createContext({steamSpotlightSessionSeed:seed,cleanDisplayText:v=>String(v||''),
    escapeHtml:v=>String(v||'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),
    productLink:p=>`product.html?id=${encodeURIComponent(p.id)}`,getStockState:()=>({className:'stock',label:'พร้อมส่ง'}),
    getCategoryLabel:()=> 'Steam',translateTagToThai:v=>v,favoriteToggleMarkup:p=>`<button data-favorite="${p.id}">รายการโปรด</button>`,
    steamPriceMarkup:()=>'<div class="price">100</div>',fastImg:(url)=>`src="${url}" loading="lazy"`});
  vm.runInContext(segment('function steamEditorialRandomScore(', 'function steamEditorialPopularRandom(')
    +segment('function productOwnedImages(', '// Shuffle once whenever')
    +segment('const catalogDiscoverySkipped', 'function renderSteamStorefront()'),context);
  return context;
}
test('real catalog yields 80 total games including 8 tag-matched shelves without duplicates',()=>{
  const ctx=setup();const model=ctx.catalogDiscoveryModel(products);
  assert.equal(model.shelves.length,8);
  const chosen=[...model.features,...model.shelves.flatMap(s=>s.products)];
  assert.equal(chosen.length,80);
  assert.equal(new Set(chosen.map(p=>ctx.catalogDiscoveryKey(p))).size,chosen.length);
  for(const shelf of model.shelves) {
    assert(shelf.products.length>=2 && shelf.products.length<=4);
    assert(shelf.products.every(p=>ctx.catalogDiscoveryTags(p).some(tag=>shelf.tags.includes(tag))));
  }
});
test('selection is stable during one visit, changes after refresh, and skip excludes the game',()=>{
  const ctx=setup();const ids=()=>Array.from(ctx.catalogDiscoveryModel(products).features,p=>p.id);
  const first=ids();assert.deepEqual(ids(),first);
  assert.notDeepEqual(Array.from(setup(4242).catalogDiscoveryModel(products).features,p=>p.id),first);
  const item=ctx.catalogDiscoveryModel(products).features[0];
  vm.runInContext(`catalogDiscoverySkipped.add(${JSON.stringify(ctx.catalogDiscoveryKey(item))})`,ctx);
  assert(!ids().includes(item.id)); assert.equal(ids().length,first.length);
});
test('initial markup contains only ten games and eight batches reach 80 without duplication',()=>{
  const ctx=setup(); const entries=ctx.catalogDiscoveryEntries(products);
  const initial=ctx.steamEditorialFeaturesMarkup(products);
  assert.equal((initial.match(/data-discovery-product=|class="catalog-genre-game"/g)||[]).length,10);
  assert.equal(entries.length,80);
  const seen=new Set();
  for(let offset=0;offset<80;offset+=10) {
    const batch=entries.slice(offset,offset+10);
    assert.equal(batch.length,10);
    for(const entry of batch) { const key=ctx.catalogDiscoveryKey(entry.product); assert(!seen.has(key)); seen.add(key); }
    const html=ctx.catalogDiscoveryBatchMarkup(entries,offset);
    assert.equal((html.match(/data-discovery-product=|class="catalog-genre-game"/g)||[]).length,10);
  }
  assert.equal(ctx.catalogDiscoveryBatchMarkup(entries,80),'');
});
test('gallery uses own distinct screenshots, keeps cover separate and does not borrow missing pictures',()=>{
  const ctx=setup();
  const html=ctx.steamEditorialFeatureMarkup({id:'test',name:'Test',image:'cover.png',gallery:['one.png','two.png','one.png'],stock:1});
  assert.equal((html.match(/src="cover.png"/g)||[]).length,1);
  assert.equal((html.match(/src="one.png"/g)||[]).length,1);
  assert.equal((html.match(/catalog-shot-empty/g)||[]).length,2);
  assert(html.includes('data-favorite="test"'));
  assert(html.includes('data-discovery-skip="test"'));
});

test('eight shelves stay intact in ten-game batches with randomized positions and four-card gaps',()=>{
  const positions=[];
  for(const seed of [42,99,2026]) {
    const entries=setup(seed).catalogDiscoveryEntries(products);
    const starts=[]; let previousEnd=-1;
    for(let offset=0;offset<80;offset+=10) {
      const batch=entries.slice(offset,offset+10);
      const indexes=batch.map((entry,index)=>entry.shelf?index:-1).filter(index=>index>=0);
      assert([2,4].includes(indexes.length));
      assert.equal(new Set(batch.filter(entry=>entry.shelf).map(entry=>entry.shelf.id)).size,1);
      assert(indexes[0]>=2);
      assert(indexes.at(-1)<=7);
      const start=offset+indexes[0];
      if(previousEnd>=0) assert(start-previousEnd-1>=4);
      previousEnd=offset+indexes.at(-1); starts.push(start);
    }
    positions.push(starts.join(','));
  }
  assert(new Set(positions).size>1);
});

test('mobile feature tags use escaped real product tags only',()=>{
  const ctx=setup();
  const html=ctx.steamEditorialFeatureMarkup({id:'tags',name:'Test',image:'cover.png',stock:1,tags:['Action','<script>',null,'',123]});
  assert(html.includes('catalog-mobile-eyebrow'));
  assert(html.includes('href="index.html?tag=Action#catalog">Action</a>'));
  assert(html.includes('data-tag-category="other"'));
  assert(html.includes('href="index.html?category=all#catalog">Steam</a>'));
  assert(html.includes('&lt;script>'));
  assert(!html.includes('<span>123</span>'));
});

test('category and genre badges total at most four and remove duplicates',()=>{
  const html=setup().catalogProductTagsMarkup({category:'offline',tags:['Action','Action','RPG','Adventure','Single-player','Sports']});
  assert.equal((html.match(/<a /g)||[]).length,4);
  assert(html.includes('data-tag-category="offline"'));
  assert(!html.includes('Single-player'));
});
test('small catalogs do not fabricate extra games or use capability tags as genres',()=>{
  const ctx=setup();const model=ctx.catalogDiscoveryModel([
    {id:'a',name:'A',stock:1,image:'a.png',tags:['Racing']},
    {id:'b',name:'B',stock:1,image:'b.png',tags:['Full controller support']},
    {id:'c',name:'C',stock:0,image:'c.png',tags:['Racing']}
  ]);
  assert.equal(model.features.length,1);assert.equal(model.shelves.length,0);
});
