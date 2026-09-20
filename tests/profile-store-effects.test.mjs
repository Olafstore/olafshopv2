import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(`${process.env.PGLITE_TEST_ROOT||process.cwd()}/package.json`);
const {Window}=await import(pathToFileURL(require.resolve('happy-dom')).href);
const source=readFileSync(new URL('../profile-store-effects.js',import.meta.url),'utf8');
test('store images leave loading on success/error and reset when their source changes',async t=>{
 const w=new Window({url:'https://shop.example/profile-store.html'});t.after(()=>w.happyDOM.close());
 w.document.body.className='profile-store-page';w.document.body.innerHTML='<button class="store-product"><img src="/one.png"></button>';
 const img=w.document.querySelector('img'),card=img.parentElement;Object.defineProperty(img,'complete',{configurable:true,get:()=>false});
 w.eval(source);assert.equal(card.dataset.shopMedia,'loading');assert.equal(card.querySelectorAll('.shop-skeleton-box').length,3);assert.equal(card.getAttribute('aria-busy'),'true');img.dispatchEvent(new w.Event('load'));assert.equal(card.dataset.shopMedia,'ready');assert.equal(card.querySelector('.shop-card-skeleton'),null);assert.equal(card.getAttribute('aria-busy'),'false');
 img.src='/two.png';await new Promise(r=>setTimeout(r,10));assert.equal(card.dataset.shopMedia,'loading');img.dispatchEvent(new w.Event('error'));assert.equal(card.dataset.shopMedia,'error');
 assert.equal(w.localStorage.getItem('olaf-site-theme'),null);
 assert.equal(card.querySelector('.shop-card-skeleton'),null);
});
test('fixed black palette is scoped to this page and reduced motion is supported',()=>{
 const css=readFileSync(new URL('../profile-store-effects.css',import.meta.url),'utf8'),html=readFileSync(new URL('../profile-store.html',import.meta.url),'utf8');
 assert(css.includes('html[data-site-theme] body.profile-store-page'));assert(css.includes('--theme-base:#090a0c'));
 assert(css.includes('prefers-reduced-motion:reduce'));assert(css.includes('[data-shop-media=error]'));
 assert(html.indexOf('profile-store-effects.css')>html.indexOf('site-refinements.css'));
});
