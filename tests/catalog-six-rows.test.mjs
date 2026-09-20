import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const segment=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));

test('catalog page size follows six actual grid rows on desktop, tablet and phone',()=>{
  let columns='250px 250px 250px 250px';
  const context=vm.createContext({document:{querySelector:()=>({})},window:{getComputedStyle:()=>({gridTemplateColumns:columns})}});
  vm.runInContext(segment('function getCatalogItemsPerPage()', 'function bindCatalogRowLimit()'),context);
  for(const n of [4,3,2,1]) { columns=Array(n).fill('200px').join(' '); assert.equal(context.getCatalogItemsPerPage(),n*6); }
});

test('default ordering changes with page seed but stays stable for pagination and filtering',()=>{
  const products=Array.from({length:80},(_,i)=>({id:`game-${i}`,name:`Game ${i}`,category:'steam-key',stock:1,price:i,tags:[]}));
  const context=vm.createContext({state:{products,selectedCategory:'all',sortBy:'default',priceFilter:'all',query:'',stockOnly:false},
    steamSpotlightSessionSeed:1,normalizeCatalogSearch:v=>String(v||'').toLowerCase(),getDisplayTags:()=>[]});
  vm.runInContext(segment('function steamEditorialRandomScore(', 'function steamEditorialPopularRandom(')+
    segment('function filteredProducts()', 'async function loadProducts()'),context);
  const ids=()=>Array.from(context.filteredProducts(),p=>p.id);
  const first=ids(); assert.deepEqual(ids(),first);
  assert.equal(new Set(first).size,80);
  context.steamSpotlightSessionSeed=123456;
  assert.notDeepEqual(ids(),first);
  context.state.sortBy='priceAsc';
  assert.deepEqual(Array.from(context.filteredProducts(),p=>p.price),Array.from({length:80},(_,i)=>i));
  context.state.query='game 79'; assert.deepEqual(ids(),['game-79']);
});

test('pagination slices to 24 cards and clamps pages when filters reduce results',()=>{
  const grid={innerHTML:''},feature={innerHTML:''}; let result=Array.from({length:100},(_,id)=>({id,stock:1,sold:id}));
  const context=vm.createContext({state:{currentPage:1},selectors:{productGrid:'grid',featuredGrid:'feature',emptyState:'empty'},
    $:selector=>selector==='grid'?grid:selector==='feature'?feature:{hidden:false},filteredProducts:()=>result,
    featuredRandomProducts:p=>p.filter(item=>item.stock>0).slice(0,4),getCatalogItemsPerPage:()=>24,renderFeatureCard:p=>`${p.id},`,renderProductCard:p=>`${p.id},`,renderPagination:()=>{},createIconSet(){},hydrateImages(){}});
  vm.runInContext(segment('function renderProducts()', 'function renderPagination('),context);
  context.renderProducts(); assert.equal(grid.innerHTML.split(',').filter(Boolean).length,24);
  assert.equal(feature.innerHTML.split(',').filter(Boolean).length,4);
  context.state.currentPage=2; context.renderProducts(); assert.equal(feature.innerHTML,'');
  context.state.currentPage=5; result=result.slice(0,2); context.renderProducts();
  assert.equal(context.state.currentPage,1); assert.equal(grid.innerHTML,'0,1,');
  assert.equal(feature.innerHTML.split(',').filter(Boolean).length,2);
});

test('pictured gallery moves below catalog without moving the activity carousel',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert(html.indexOf('id="catalog-game-preview"')>html.indexOf('id="pagination-controls"'));
  assert(html.indexOf('id="catalog-game-preview"')<html.indexOf('id="contact"'));
  const renderer=segment('function renderSteamStorefront()', 'function renderCategories()');
  assert(renderer.includes('mountCatalogDiscoveryFeed(products)'));
  assert(renderer.includes('steamActivityCarouselMarkup(products)'));
  const feature=segment('function steamEditorialFeaturesMarkup(products)', 'function renderSteamStorefront()');
  assert(!feature.includes('steamActivityCarouselMarkup'));
});

test('special offers shuffle without duplicates while retaining discounts',()=>{
  const products=Array.from({length:30},(_,i)=>({id:String(i),name:`Game ${i}`,stock:i===0?0:1,steamAppId:i}));
  products.push({...products[1],id:'duplicate'});
  const ctx=vm.createContext({steamSpotlightSessionSeed:42,cleanDisplayText:v=>String(v||''),steamStorefrontProducts:()=>products,getDiscount:()=>50});
  vm.runInContext(segment('function steamEditorialRandomScore(', 'function steamEditorialPopularRandom(')+segment('function catalogDiscoveryKey(', 'function catalogDiscoveryTags(')+segment('function steamDealsProducts()', 'function steamDiscoveryProducts('),ctx);
  const first=Array.from(ctx.steamDealsProducts(),p=>p.steamAppId);
  assert.equal(first.length,12); assert.equal(new Set(first).size,12); assert(!first.includes(0));
  ctx.steamSpotlightSessionSeed=87654;
  assert.notDeepEqual(Array.from(ctx.steamDealsProducts(),p=>p.steamAppId),first);
});

test('featured cards shuffle per refresh, remain stable per visit and exclude duplicate games and empty stock',()=>{
  const products=Array.from({length:30},(_,i)=>({id:String(i),name:`Game ${i}`,stock:i===0?0:1,steamAppId:i}));
  products.push({...products[1],id:'duplicate'});
  const ctx=vm.createContext({steamSpotlightSessionSeed:42,cleanDisplayText:v=>String(v||'')});
  vm.runInContext(segment('function steamEditorialRandomScore(', 'function steamEditorialPopularRandom(')+segment('function catalogDiscoveryKey(', 'function catalogDiscoveryTags(')+segment('function featuredRandomProducts(', 'function renderProducts()'),ctx);
  const first=Array.from(ctx.featuredRandomProducts(products),p=>p.steamAppId);
  assert.equal(first.length,4); assert.equal(new Set(first).size,4); assert(!first.includes(0));
  assert.deepEqual(Array.from(ctx.featuredRandomProducts(products),p=>p.steamAppId),first);
  ctx.steamSpotlightSessionSeed=87654;
  assert.notDeepEqual(Array.from(ctx.featuredRandomProducts(products),p=>p.steamAppId),first);
  assert.equal(ctx.featuredRandomProducts(products.slice(0,2)).length,1);
});
