// Real page shell/styles and card renderer, isolated mock products, no live services.
import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(`${process.env.BROWSER_TEST_ROOT}/package.json`),{chromium}=require('playwright');
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const app=read('app.js'),card=app.slice(app.indexOf('function renderProductCard('),app.indexOf('function openProduct('));
const render=app.slice(app.indexOf('function renderProducts()'),app.indexOf('function showAuthPanel('));
const html=read('products.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="920" height="430"><rect width="920" height="430" fill="#19335c"/><circle cx="720" cy="210" r="160" fill="#4251a0"/><text x="60" y="240" fill="white" font-size="52">STEAM GAME</text></svg>';
const server=createServer((req,res)=>{const p=new URL(req.url,'http://local').pathname.slice(1);try{if(p.endsWith('.css')||p==='image-performance.js'){res.setHeader('Content-Type',p.endsWith('.css')?'text/css':'application/javascript');res.end(read(p));}else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);}}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 mkdirSync(new URL('../reports/',import.meta.url),{recursive:true});
 for(const width of [390,820,1440]){
  const page=await browser.newPage({viewport:{width,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname.endsWith('steamstatic.com')||u.hostname==='fixture.invalid')return r.fulfill({contentType:'image/svg+xml',body:svg});if(u.origin===origin)return r.continue();return r.abort();});
  await page.goto(origin+'/products.html');await page.addScriptTag({url:origin+'/image-performance.js'});
  await page.addScriptTag({content:`const isFullCatalogPage=true;const products=Array.from({length:50},(_,i)=>({id:String(i),steamAppId:12345,name:i%2?'A Longer Game Title Deluxe Edition':'Fixture Game',image:'https://fixture.invalid/cover',stock:1,price:49,compareAt:199,publisher:'Steam',category:['offline','steam-key','steam-account'][i%3]}));
  const state={heroCatalogLoading:false,currentPage:1,selectedCategory:'all'},selectors={productGrid:'#product-grid',featuredGrid:'#featured-grid',emptyState:'#empty-state',paginationControls:'#pagination-controls'},$=s=>document.querySelector(s);
  const escapeHtml=s=>String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),formatPrice=n=>'฿'+n,getStockState=()=>({label:'พร้อมจำหน่าย',className:'in-stock'}),getDiscount=()=>75,catalogProductTagsMarkup=()=>'<span class="tag">Steam Offline</span><span class="tag">ผจญภัย</span>',favoriteToggleMarkup=()=>'',renderBadgePills=()=>'<span class="platform-badge">STEAM</span>',catalogImageOptions=()=>({loading:'lazy'}),fastImg=(s,a,o)=>window.OlafImages.attrs(s,a,o),t=()=> 'ดูรายละเอียด',filteredProducts=()=>products.filter(p=>state.selectedCategory==='all'||p.category===state.selectedCategory),getCatalogItemsPerPage=()=>24,featuredRandomProducts=()=>[],renderFeatureCard=()=>'',createIconSet=()=>{},hydrateImages=()=>window.OlafImages.scheduleHydrate();
  const productLink=p=>'product.html?id='+p.id,getCategoryLabel=id=>id;
  ${card}\n${render}
  document.querySelector('#category-tabs').innerHTML=[['all','สินค้าทั้งหมด'],['offline','ไอดีออฟไลน์'],['steam-key','คีย์เกม'],['steam-account','ไอดียกเมล']].map(([id,label])=>'<button class="tab-button" data-fixture-category="'+id+'">'+label+'</button>').join('');
  document.addEventListener('click',e=>{if(e.target.closest('[data-catalog-more]')){state.currentPage++;renderProducts()}if(e.target.dataset.fixtureCategory){state.selectedCategory=e.target.dataset.fixtureCategory;state.currentPage=1;renderProducts()}});renderProducts();`});
  await page.addScriptTag({content:read('catalog-v16.js').replace("document.addEventListener('DOMContentLoaded',()=>{","(()=>{").replace(/\}\);\s*$/, '})();')});
  assert.equal(await page.locator('#product-grid .product-card').count(),24);
  await page.evaluate(()=>window.firstCatalogImage=document.querySelector('#product-grid img'));
  await page.getByRole('button',{name:'มุมมองรายการ',exact:true}).click();assert(await page.locator('.products-wrap').evaluate(n=>n.classList.contains('catalog-list-view')));
  assert(await page.locator('#product-grid .product-card').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().height<220)),'all list rows including offscreen rows must be compact');
  await page.getByRole('button',{name:'มุมมองตาราง',exact:true}).click();assert(!(await page.locator('.products-wrap').evaluate(n=>n.classList.contains('catalog-list-view'))));
  await page.locator('.catalog-load-sentinel').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelectorAll('#product-grid .product-card').length>=48);
  assert((await page.locator('#product-grid .product-card').count())>=48);
  assert(await page.evaluate(()=>window.firstCatalogImage===document.querySelector('#product-grid img')),'load more must preserve loaded image nodes');
  await page.getByRole('button',{name:'มุมมองรายการ',exact:true}).click();
  assert(await page.locator('#product-grid .product-card').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().height<220)),'appending products must not enlarge list rows');
  await page.getByRole('button',{name:'มุมมองตาราง',exact:true}).click();
  await page.locator('#category-tabs [data-fixture-category="offline"]').click();assert.equal(await page.locator('#product-grid .product-card').count(),17);
  await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
  await page.locator('#product-grid').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#product-grid .product-card')).every(n=>Number(getComputedStyle(n).opacity)>0));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow '+width);
  await page.screenshot({path:fileURLToPath(new URL(`../reports/catalog-v13-${width}.png`,import.meta.url)),fullPage:true});
  assert.deepEqual(errors,[]);await page.close();console.log(`Catalog shell/cards/category/page PASS ${width}px`);
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
