import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
const require=createRequire(`${process.env.PGLITE_TEST_ROOT || process.cwd()}/package.json`);
const {Window}=await import(pathToFileURL(require.resolve('happy-dom')).href);
const source=readFileSync(new URL('../product-hover.js',import.meta.url),'utf8');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function setup(t,desktop=true){const w=new Window({url:'https://shop.example/index.html',width:1200,height:800});t.after(()=>w.happyDOM.close());w.matchMedia=query=>({matches:query.includes('reduced-motion')?false:desktop,addEventListener(){}});
 w.HTMLElement.prototype.getBoundingClientRect=function(){return {left:100,top:100,width:320,height:400};};
 w.document.body.innerHTML='<article class="product-card"><img src="game.jpg" alt="Game"><h3>Game</h3><strong class="price">฿99</strong><a href="product.html?id=game">Details</a></article>';return w;}
function hover(w,type='mouse',x=500,y=200){w.document.querySelector('article').dispatchEvent(new w.PointerEvent('pointerover',{bubbles:true,pointerType:type,clientX:x,clientY:y}));}
test('preview cover and gallery fill their frames without letterboxing or stretching',()=>{
 const css=readFileSync(new URL('../product-hover.css',import.meta.url),'utf8');
 assert.match(css,/\.hover-preview-cover img\{[^}]*object-fit:cover[^}]*padding:0/);
 assert.match(css,/aside\.product-hover-preview \.hover-preview-media img\{object-fit:cover;object-position:center/);
 assert(!css.includes('object-fit:contain'));
});
test('compact preview uses gallery only, repairs Thai and retains real price and favorites',async t=>{
 const w=setup(t);w.OlafFavorites={getIds:()=>['game']};
 w.OlafProducts={fetchProductById:async()=>({id:'game',name:'Demo',image:'cover.jpg',gallery:['gallery.jpg'],price:40,compareAt:800,rating:Buffer.from('แง่บวกเป็นอย่างมาก | 12,598 รีวิว','utf8').toString('latin1'),tags:['Action'],stock:2})};
 w.eval(source);hover(w);await sleep(950);const popup=w.document.querySelector('aside');
 assert.equal(popup.querySelector('.hover-preview-discount').textContent,'-95%');
 assert.equal(popup.querySelector('.hover-preview-price strong').textContent,'฿40');
 assert(popup.querySelector('.hover-preview-media img').src.endsWith('gallery.jpg'));
 assert(popup.querySelector('.hover-preview-cover img').src.endsWith('cover.jpg'));
 assert(!popup.querySelector('.hover-preview-media img').src.endsWith('cover.jpg'));
 assert.equal(popup.querySelector('.hover-preview-rating').textContent,'แง่บวกเป็นอย่างมาก');
 assert.equal(popup.querySelector('.hover-preview-review-count').textContent,'12,598 รีวิว');
 assert(popup.querySelector('.hover-preview-favorite').classList.contains('is-saved'));
 assert(!popup.querySelector('.hover-preview-description'));
 assert(!popup.querySelector('.hover-preview-meta').textContent.includes('2026'));
});

test('large spotlight and nested links never open mini previews; other cards still do',async t=>{
 const w=setup(t);let calls=0;w.OlafProducts={fetchProductById:async()=>{calls++;return {name:'Game'};}};
 const spotlight=w.document.createElement('article');spotlight.className='olaf-steam-spotlight';spotlight.innerHTML='<a href="product.html?id=featured"><img alt="Featured"></a>';w.document.body.append(spotlight);w.eval(source);
 for(const target of [spotlight,spotlight.querySelector('a'),spotlight.querySelector('img')])target.dispatchEvent(new w.PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));
 await sleep(320);assert.equal(calls,0);assert.equal(w.document.querySelector('aside'),null);
 hover(w);await sleep(320);assert.equal(calls,1);
 spotlight.querySelector('img').dispatchEvent(new w.PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));await sleep(180);assert(w.document.querySelector('aside').hidden);
});
test('desktop preview anchors to the card, stays fixed and keeps a usable details link',async t=>{
 const w=setup(t);let calls=0;w.OlafProducts={fetchProductById:async()=>{calls++;return {name:'<b>Game</b>',price:99,description:'<script>bad</script> Description',tags:['<img onerror=x>'],stock:4};}};
 w.HTMLElement.prototype.getBoundingClientRect=function(){return {width:330,height:420,top:0,left:0};};
 w.eval(source);hover(w,'mouse',1180,790);assert.equal(w.document.querySelector('aside'),null);await sleep(320);
 assert(w.document.querySelector('aside').classList.contains('is-loading'));await sleep(650);
 const popup=w.document.querySelector('aside');assert.equal(popup.hidden,false);assert.equal(calls,1);assert.equal(popup.querySelector('script'),null);assert.equal(popup.querySelectorAll('.hover-preview-media img').length,0);
 assert(popup.querySelector('.hover-preview-empty').textContent.includes('ยังไม่มีภาพแกลเลอรี'));
 assert.equal(popup.style.left,'12px');assert.equal(popup.style.top,'12px');assert.equal(popup.style.transform,'');
 w.document.querySelector('article').dispatchEvent(new w.PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',clientX:200,clientY:100}));await sleep(30);assert.equal(popup.style.left,'12px');assert.equal(popup.style.top,'12px');
 const overlay=popup.querySelector('.hover-preview-open');assert.equal(overlay.getAttribute('href'),'product.html?id=game');
 w.document.querySelector('article').dispatchEvent(new w.PointerEvent('pointerout',{bubbles:true,relatedTarget:overlay}));assert(popup.classList.contains('is-visible'));
 overlay.dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true}));assert(popup.classList.contains('is-visible'));
 w.document.dispatchEvent(new w.Event('scroll'));assert(!popup.classList.contains('is-visible'));await sleep(170);assert(popup.hidden);
 hover(w);await sleep(310);assert.equal(calls,1);
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));await sleep(170);assert(popup.hidden);
 assert(!w.document.querySelector('article').classList.contains('has-mini-preview'));
});
test('touch and small viewport do not render or fetch previews',async t=>{
 for(const desktop of [true,false]){const w=setup(t,desktop);let calls=0;w.OlafProducts={fetchProductById:async()=>{calls++;}};w.eval(source);hover(w,desktop?'touch':'mouse');await sleep(310);assert.equal(calls,0);assert.equal(w.document.querySelector('aside'),null);}
});
test('featured row preview matches its main artwork bounds with integer pixel placement',async t=>{
 const w=setup(t);const card=w.document.querySelector('article');card.className='olaf-steam-taste-row';
 card.querySelector('a').className='olaf-steam-taste-main';
 w.HTMLElement.prototype.getBoundingClientRect=function(){
  if(this.matches('.olaf-steam-taste-main'))return {left:100.3,top:120.4,width:640.2,height:360.1};
  if(this.matches('aside'))return {left:0,top:0,width:640,height:360};
  return {left:30,top:40,width:1100,height:550};
 };
 w.OlafProducts={fetchProductById:async()=>({name:'Game',price:2099,compareAt:2390})};
 w.eval(source);hover(w);await sleep(950);const popup=w.document.querySelector('aside');
 assert(popup.classList.contains('is-image-anchored'));assert.equal(popup.style.width,'672px');assert.equal(popup.style.height,'378px');
 assert.equal(popup.style.left,'84px');assert.equal(popup.style.top,'111px');assert.equal(popup.style.transform,'');
 assert(!card.classList.contains('has-mini-preview'));
 const css=readFileSync(new URL('../product-hover.css',import.meta.url),'utf8');
 assert(css.includes('will-change:auto'));assert(css.includes('font-variant-numeric:tabular-nums'));
});
test('catalog, deals and editorial cards all use anchored replacement and restore on leave',async t=>{
 const w=setup(t);w.OlafProducts={fetchProductById:async()=>({id:'game',name:'Demo',gallery:[],price:39})};w.eval(source);
 for(const cls of ['feature-card','product-card','olaf-steam-deal-card','olaf-steam-editorial-card','catalog-genre-game']){
  const card=w.document.querySelector('article');card.className=cls;hover(w);await sleep(310);
  const popup=w.document.querySelector('aside');assert(!card.classList.contains('has-mini-preview'),cls);assert(popup.classList.contains('is-visible'));
  const overlay=popup.querySelector('.hover-preview-open');
  card.dispatchEvent(new w.PointerEvent('pointerout',{bubbles:true,relatedTarget:overlay}));assert(popup.classList.contains('is-visible'));
  overlay.dispatchEvent(new w.PointerEvent('pointerout',{bubbles:true,relatedTarget:w.document.body}));
  assert(!card.classList.contains('has-mini-preview'));await sleep(170);assert(popup.hidden);
 }
});
test('profile page never activates shopping hover preview even with desktop mouse',async t=>{
 const w=setup(t);w.happyDOM.setURL('https://shop.example/profile.html#overview');let calls=0;
 w.OlafProducts={fetchProductById:async()=>calls++};w.eval(source);hover(w);await sleep(310);
 assert.equal(calls,0);assert.equal(w.document.querySelector('aside'),null);
});
test('wide, tall and short previews expand 5% around the source centre',async t=>{
 const w=setup(t);const card=w.document.querySelector('article');
 w.OlafProducts={fetchProductById:async()=>({name:'Demo',price:49,compareAt:1999,tags:['Action'],rating:'แง่บวก | 100 รีวิว'})};w.eval(source);
 for(const [cls,width,height] of [['catalog-genre-game',675,454],['olaf-steam-editorial-card',674,420],['olaf-steam-deal-card',440,460],['olaf-steam-deal-card',440,220],['feature-card',270,185]]){
  card.className=cls;card.getBoundingClientRect=()=>({left:100,top:100,width,height});
  hover(w);await sleep(310);const popup=w.document.querySelector('aside');
  const expandedWidth=Math.round(width*1.05),expandedHeight=Math.round(height*1.05);
  assert.equal(popup.style.left,Math.round(100+(width-expandedWidth)/2)+'px');assert.equal(popup.style.top,Math.round(100+(height-expandedHeight)/2)+'px');
  assert.equal(popup.style.width,expandedWidth+'px');assert.equal(popup.style.height,expandedHeight+'px');
  assert.equal(popup.classList.contains('is-compact-card'),expandedHeight<300);
  assert.equal(popup.classList.contains('is-short-card'),expandedHeight<190);
  card.dispatchEvent(new w.PointerEvent('pointerout',{bubbles:true,relatedTarget:w.document.body}));await sleep(170);
 }
 const css=readFileSync(new URL('../product-hover.css',import.meta.url),'utf8');
 assert(css.includes('transform:scale(.965)'));assert(css.includes('to{transform:none;opacity:1;}'));
});
test('late product response cannot reopen preview after mouse leaves',async t=>{
 const w=setup(t);let resolve;w.OlafProducts={fetchProductById:()=>new Promise(done=>resolve=done)};w.eval(source);hover(w);await sleep(310);
 w.document.querySelector('article').dispatchEvent(new w.PointerEvent('pointerout',{bubbles:true,relatedTarget:w.document.body}));resolve({name:'Late',price:1});await sleep(170);assert(w.document.querySelector('aside').hidden);
});
test('loading skeleton ends without size changes, gallery crossfades one image at a time and stops on leave',async t=>{
 const w=setup(t);let resolve;w.OlafProducts={fetchProductById:()=>new Promise(done=>resolve=done)};
 const ticks=[],images=[],originalTimeout=w.setTimeout.bind(w);
 w.setTimeout=(fn,delay,...args)=>{if(delay===1500){ticks.push(fn);return 0;}return originalTimeout(fn,delay,...args);};
 w.Image=function(){const img=w.document.createElement('img');images.push(img);return img;};
 w.eval(source);hover(w);await sleep(310);const popup=w.document.querySelector('aside');
 assert(popup.classList.contains('is-loading'));assert.equal(popup.getAttribute('aria-busy'),'true');
 resolve({name:'Game',description:'Long '.repeat(100),gallery:['second.jpg','third.jpg'],price:99});await sleep(20);
 assert(popup.classList.contains('is-loading'));await sleep(650);
 assert(!popup.classList.contains('is-loading'));assert.equal(popup.getAttribute('aria-busy'),'false');assert.equal(images.length,0);
 ticks.shift()();assert.equal(images.length,1);assert(images[0].src.endsWith('third.jpg'));images[0].onload();await sleep(260);
 assert.equal(popup.querySelectorAll('.hover-preview-media img').length,1);assert(popup.querySelector('img').src.endsWith('third.jpg'));
 ticks.shift()();assert(images[1].src.endsWith('second.jpg'));images[1].onload();await sleep(260);
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));ticks.shift()();assert.equal(images.length,2);
 const css=readFileSync(new URL('../product-hover.css',import.meta.url),'utf8');assert(css.includes('flex-direction:column;height:auto'));assert(!css.includes('.has-mini-preview'));assert(css.includes('aspect-ratio:16/9'));
});
