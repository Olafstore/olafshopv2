import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(`${process.env.PGLITE_TEST_ROOT||process.cwd()}/package.json`);
const {Window}=await import(pathToFileURL(require.resolve('happy-dom')).href);
test('theme restores everywhere without mounting menu or standalone theme buttons',async t=>{
 for(const page of ['index','login','profile','profile-store']){
  const w=new Window({url:`https://shop.example/${page}.html`});t.after(()=>w.happyDOM.close());
  w.document.body.innerHTML='<div class="topbar-actions"></div><div class="site-theme-switcher">old</div>';
  w.localStorage.setItem('olaf-site-theme','light');w.eval(readFileSync(new URL('../site-theme.js',import.meta.url),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  assert.equal(w.document.documentElement.dataset.siteTheme,'main');assert.equal(w.document.querySelectorAll('.site-theme-switcher,[data-site-theme-open]').length,0);
 }
});
test('mobile shelf moves controls below images and all pages receive the shared companion palette',()=>{
 const css=readFileSync(new URL('../site-mobile-friends.css',import.meta.url),'utf8');
 assert(css.includes('bottom:-54px'));assert(css.includes('grid-column:1/-1;aspect-ratio:2.1'));assert(css.includes('height:auto!important'));assert(css.includes('var(--theme-card)!important'));
 for(const page of ['index','profile','product','more-products','free-games','free-random','point-topup','profile-store','login','register','public-profile','olaf-control']){
  const html=readFileSync(new URL('../'+page+'.html',import.meta.url),'utf8');assert(html.indexOf('site-mobile-friends.css')>html.indexOf('site-theme-light.css'),page);
 }
 assert(readFileSync(new URL('../friends.css',import.meta.url),'utf8').includes('.friends-launch{display:none!important}'));
});
