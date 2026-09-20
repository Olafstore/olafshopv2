import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {productUrl,metadata} from '../lib/seo.js';
test('old product links redirect to the server-rendered route without a loop',()=>{
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 const redirect=config.redirects.find(r=>r.source==='/product.html');assert.equal(redirect.destination,'/product');
 assert(!config.redirects.some(r=>r.source==='/product'));
 assert.equal(config.rewrites.find(r=>r.source==='/product').destination,'/api/product-page');
 assert.equal(productUrl('007 First Light'),'https://olafshop.com/product?id=007%20First%20Light');
 const m=metadata({id:'game-1',name:'Game One',image:'https://cdn.example/one.jpg'});
 assert(m.html.includes('https://olafshop.com/product?id=game-1'));assert(m.html.includes('https://cdn.example/one.jpg'));
});
