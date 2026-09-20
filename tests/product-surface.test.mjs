import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderProduct} from '../api/product-page.js';
import vm from 'node:vm';
const css=readFileSync(new URL('../product-surface-fix.css',import.meta.url),'utf8');
test('product overrides load after shared surfaces in static and server templates',()=>{
 for(const html of [readFileSync(new URL('../product.html',import.meta.url),'utf8'),renderProduct({id:'demo',name:'Demo'})]){
  assert(html.indexOf('product-surface-fix.css')>html.indexOf('site-refinements.css'));
  assert(html.includes('site-navigation.js?v=20260912-product-search-v251'));
 }
});
test('server page restores the original skeleton and reveals readable fallback if loading stalls',()=>{
 const html=renderProduct({id:'demo',name:'Demo',image:'https://example.com/cover.png'});
 assert(html.includes('skeleton-sidebar'));assert(html.includes('product-server-summary'));
 assert(html.includes('property="og:image"'));assert(html.includes('prefers-reduced-motion:reduce'));
 const script=html.match(/<script>(document.documentElement.classList.add\("product-loading"\);[\s\S]*?)<\/script>/)[1];
 const classes=new Set();let fallback;
 vm.runInNewContext(script,{document:{documentElement:{classList:{add:n=>classes.add(n),remove:n=>classes.delete(n)}}},setTimeout:(fn,ms)=>{assert.equal(ms,12000);fallback=fn;}});
 assert(classes.has('product-loading'));fallback();assert(!classes.has('product-loading'));
});
test('outer sections are transparent; cards use theme tokens and search stays unclipped',()=>{
 assert(css.includes('#product-page .pd-section{\n background:transparent!important'));
 assert(css.includes('background:var(--theme-card)!important'));
 assert(css.includes('overflow:visible!important'));
 assert(css.includes('@media(min-width:761px)'));
 assert(css.includes('#topbar-search-form)>input'));
});
