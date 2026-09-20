import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf('function heroCarouselProducts()');
const code=source.slice(start,source.indexOf('function renderHeroDeal()',start));
test('hero fills five real in-stock games when preview list contains only three',()=>{
  const products=Array.from({length:8},(_,i)=>({id:String(i),stock:i===0?0:1}));
  const ctx=vm.createContext({state:{products,steamPreviewOrder:['1','2','3','missing']}});
  vm.runInContext(code,ctx);
  const games=ctx.heroCarouselProducts();
  assert.deepEqual(Array.from(games,p=>p.id),['1','2','3','4','5']);
  ctx.state.products=products.slice(0,3);
  assert.equal(ctx.heroCarouselProducts().length,2);
});
test('initial hero reserves all five cards using the shared product skeleton animation',()=>{
  const ctx=vm.createContext({}); vm.runInContext(code,ctx);
  const html=ctx.heroLoadingMarkup();
  assert.equal((html.match(/hero-game-skeleton skeleton-box/g)||[]).length,5);
  assert(html.includes('aria-busy="true"'));
  assert(source.includes('if (state.heroCatalogLoading) { heroDeal.innerHTML = heroLoadingMarkup(); return; }'));
  assert(source.includes('await loadProducts();\n  state.heroCatalogLoading = false;'));
});

test('all catalog zones show shared skeletons without fallback products during loading',()=>{
  const nodes=new Map();
  const ctx=vm.createContext({getCatalogItemsPerPage:()=>12,document:{querySelector:selector=>{
    if(!nodes.has(selector)) {const attrs=new Map(); nodes.set(selector,{innerHTML:'',hidden:true,hasAttribute:key=>attrs.has(key),setAttribute:(key,value)=>attrs.set(key,value)});}
    return nodes.get(selector);
  }}});
  const begin=source.indexOf('function renderHomeLoading()');
  vm.runInContext(source.slice(begin,source.indexOf('function activityPopupKey(',begin)),ctx);
  ctx.renderHomeLoading();
  for(const selector of ['#product-grid','#featured-grid','#olaf-steam-storefront','#steam-preview-zone','#catalog-game-preview','#widget-zone']) {
    const node=nodes.get(selector);
    assert.equal(node.hidden,false);
    assert(node.innerHTML.includes('skeleton-box'));
    assert(!node.innerHTML.includes('<img'));
  }
  assert.equal((nodes.get('#product-grid').innerHTML.match(/home-loading-card/g)||[]).length,12);
  const original=nodes.get('#product-grid').innerHTML;
  ctx.renderHomeLoading(); assert.equal(nodes.get('#product-grid').innerHTML,original);
});
