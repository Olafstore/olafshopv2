import test from 'node:test';
import assert from 'node:assert/strict';
import {getProducts,metadata,sitemap,fallbackImage} from '../lib/seo.js';
import handler,{renderProduct} from '../api/product-page.js';
import {createHandler} from '../api/site-image.js';
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},end(body){this.body=body;return this;}});
test('every active catalog game has its own server HTML, canonical and share cover',async()=>{
 const products=await getProducts(null,{env:{}});assert(products.length>400);
 for(const p of products){assert(!/[\x00-\x1f\x7f/\\]/.test(p.id),p.id);const m=metadata(p),html=renderProduct(p);assert(html.includes(m.html));assert.equal((html.match(/<title>/g)||[]).length,1);assert(html.includes('<h1>'));assert(html.includes('skeleton-sidebar'));assert(m.url.includes(encodeURIComponent(p.id)));assert(m.image.startsWith('https://'));}
});
test('metadata escapes injection and rejects unsafe image protocols',()=>{
 const m=metadata({id:'x',name:'Bad " <script>alert(1)</script>',description:'</script><script>bad</script>',image:'javascript:alert(1)'});assert.equal(m.image,fallbackImage);assert(!m.html.includes('<script>alert'));assert(m.html.includes('&quot;'));assert(m.html.includes('application/ld+json'));
});
test('live catalog includes new games and does not resurrect removed games from snapshot',async()=>{
 const env={SUPABASE_URL:'https://db.example',SUPABASE_ANON_KEY:'public-test'};
 const fetcher=async(url,opts)=>{assert.equal(url.searchParams.get('is_active'),'eq.true');assert.equal(opts.headers.apikey,'public-test');return {ok:true,json:async()=>[{id:'new',name:'New game',image_url:'https://example.com/cover.jpg'}]};};
 assert.equal((await getProducts('new',{env,fetcher}))[0].id,'new');assert.deepEqual(await getProducts('removed',{env,fetcher:async()=>({ok:true,json:async()=>[]})}),[]);
 await assert.rejects(getProducts('new',{env,fetcher:async()=>({ok:false})}));
});
test('sitemap excludes inactive products and contains unique canonical game URLs',async()=>{
 const products=await getProducts(null,{env:{}}),xml=sitemap(products);assert.equal((xml.match(/<loc>/g)||[]).length,products.length+3);assert(!xml.includes('<lastmod>'));assert(xml.includes('/product?id='));
});
test('invalid IDs and methods return correct statuses',async()=>{
 for(const id of ['', '../private', 'x'.repeat(181)]){const res=response();await handler({method:'GET',url:'/product.html?id='+encodeURIComponent(id)},res);assert.equal(res.code,404);}
 const res=response();await handler({method:'POST',url:'/product.html?id=test'},res);assert.equal(res.code,405);
});
test('share image follows the admin logo including replacement and removal',async()=>{
 const env={SUPABASE_URL:'https://db.example',SUPABASE_ANON_KEY:'public-test'};let logo='data:image/png;base64,iVBORw0KGgo=';
 const siteImage=createHandler({env,fetcher:async url=>{assert.equal(url.searchParams.get('select'),'settings->>siteIconUrl');assert.equal(url.searchParams.get('id'),'eq.main');return {ok:true,json:async()=>[{siteIconUrl:logo}]};}});
 const res=response();await siteImage({method:'GET'},res);assert.equal(res.code,200);assert(Buffer.isBuffer(res.body));assert.equal(res.headers['Cache-Control'],'no-store');
 const head=response();await siteImage({method:'HEAD'},head);assert.equal(head.body,undefined);
 logo='https://cdn.example/new-logo.png';const updated=response();await siteImage({method:'GET'},updated);assert.equal(updated.code,302);assert.equal(updated.headers.Location,logo);
 logo='';const cleared=response();await siteImage({method:'GET'},cleared);assert.equal(cleared.code,404);
 logo='javascript:alert(1)';const invalid=response();await siteImage({method:'GET'},invalid);assert.equal(invalid.code,422);
 const missing=response();await createHandler({env:{}})({method:'GET'},missing);assert.equal(missing.code,503);
});
