import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {editorialContext} from './editorial-test-context.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const context=editorialContext();
test('collection footer pairs title and category with real discount and stacked prices',()=>{
 const html=context.steamEditorialCardMarkup({id:'demo',name:'Game <test>',price:49,compareAt:199,image:'cover.png'});
 assert(html.includes('editorial-product-details'));assert(html.includes('catalog-product-tags'));
 assert(html.includes('Game &lt;test&gt;'));assert(html.includes('>-75%</span>'));
 assert(html.includes('<del>฿199</del>'));assert(html.includes('<strong>฿49</strong>'));
 assert(!html.includes('olaf-steam-editorial-overlay'));
 const regular=context.steamEditorialCardMarkup({id:'demo',name:'Game',price:49,compareAt:49});
 assert(!regular.includes('<del>'));assert(!regular.includes('<b>'));
});
test('price styling is scoped, responsive and loaded after common home styles',()=>{
 const css=read('editorial-card-prices.css'),html=read('index.html');
 assert(css.includes('.editorial-product-details>.olaf-steam-price'));
 assert(css.includes('grid-column:1!important;grid-row:3;'));
 assert(css.includes('.olaf-steam-deal-meta>.olaf-steam-price {margin-left:auto;'));
 assert(css.includes('font-variant-numeric:tabular-nums'));
 assert(css.includes('@media(max-width:640px)'));
 assert(html.indexOf('editorial-card-prices.css')>html.indexOf('home-carousel-fade.css'));
});

test('two different real-tag genres supply two and four unique available games',()=>{
 const products=JSON.parse(read('api/products.json')).products;
 const rows=context.steamEditorialCollections(products);
 assert.deepEqual(Array.from(rows,r=>r.products.length),[2,4]);
 assert.notEqual(rows[0].id,rows[1].id);
 const keys=rows.flatMap(r=>r.products.map(p=>context.catalogDiscoveryKey(p)));
 assert.equal(new Set(keys).size,6);
 for(const row of rows)assert(row.products.every(p=>p.stock>0 && context.catalogDiscoveryTags(p).some(t=>row.tags.includes(t))));
 assert.deepEqual(context.steamEditorialCollections(products),rows);
 const signatures=[42,4242,999,222].map(seed=>JSON.stringify(editorialContext(seed).steamEditorialCollections(products).map(r=>[r.id,r.products.map(p=>p.id)])));
 assert(new Set(signatures).size>1);
 assert(new Set([42,4242,999,222].flatMap(seed=>Array.from(editorialContext(seed).steamEditorialCollections(products),r=>r.id))).size>2);
});

test('missing matching stock never falls back to unrelated games or duplicates',()=>{
 const p=(id,tags,extras={})=>({id,name:id,tags,stock:1,image:'cover.png',...extras});
 const products=[p('race1',['Racing']),p('race2',['แข่งรถ']),p('unrelated',['controller']),p('inactive',['racing'],{isActive:false}),p('empty',['racing'],{stock:0})];
 const rows=context.steamEditorialCollections(products);
 assert.equal(rows.length,1);assert.equal(rows[0].id,'racing');assert.equal(rows[0].products.length,2);
 assert.equal(context.steamEditorialCollections([products[0],products[2]]).length,0);
 const html=context.steamEditorialCardMarkup(p('tagtest',['<script>','Racing']));
 assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));
 assert(html.startsWith('\n    <article'));assert(!html.includes('editorial-purchase-row'));
});
