import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
const require=createRequire(`${process.env.PGLITE_TEST_ROOT || process.cwd()}/package.json`);
const {Window}=await import(pathToFileURL(require.resolve('happy-dom')).href);
test('site theme restores preference before render and switches both directions',async t=>{
 const w=new Window({url:'https://shop.example/profile.html'});t.after(()=>w.happyDOM.close());
 w.localStorage.setItem('olaf-site-theme','store');
 w.eval(readFileSync(new URL('../site-theme.js',import.meta.url),'utf8'));
 assert.equal(w.document.documentElement.dataset.siteTheme,'store');
 w.OlafTheme.set('main');assert.equal(w.localStorage.getItem('olaf-site-theme'),'main');
 assert.equal(w.document.documentElement.dataset.siteTheme,'main');
 const home=new Window({url:'https://shop.example/index.html'});t.after(()=>home.happyDOM.close());home.localStorage.setItem('olaf-site-theme','store');home.eval(readFileSync(new URL('../site-theme.js',import.meta.url),'utf8'));assert.equal(home.document.documentElement.dataset.siteTheme,'store');
 home.dispatchEvent(new home.StorageEvent('storage',{key:'olaf-site-theme',newValue:'main'}));assert.equal(home.document.documentElement.dataset.siteTheme,'main');
 home.dispatchEvent(new home.StorageEvent('storage',{key:'olaf-site-theme',newValue:'store'}));assert.equal(home.document.documentElement.dataset.siteTheme,'store');
});
test('animated history closes only after its closing animation',async t=>{
 const w=new Window();t.after(()=>w.happyDOM.close());w.matchMedia=()=>({matches:false});
 w.document.body.innerHTML='<details><summary>History</summary><p>Entries</p></details>';
 w.eval(readFileSync(new URL('../site-theme.js',import.meta.url),'utf8'));
 const root=w.document.querySelector('details');let animation;
 root.animate=()=>animation={};w.OlafTheme.animateDetails(root);
 root.querySelector('summary').click();assert.equal(root.open,true);animation.onfinish();
 root.querySelector('summary').click();assert.equal(root.open,true);animation.onfinish();assert.equal(root.open,false);
});

test('profile and index load shared Midnight surfaces and preserve artwork/status colors',()=>{
 for(const page of ['profile.html','index.html']){
  const html=readFileSync(new URL('../'+page,import.meta.url),'utf8');
  assert(html.includes('site-theme.js?v=20260912-original-v249'));
  assert(html.includes('site-theme-surfaces.css?v=20260909-midnight-v238'));
 }
 const css=readFileSync(new URL('../site-theme-surfaces.css',import.meta.url),'utf8');
 for(const selector of ['.member-stats','.profile-sidebar-balance-row','.profile-points-card','.profile-sidebar-logout','.profile-orders-card','.product-card','.notification-popover','.friends-dialog','.friend-confirm','#catalog-game-preview'])assert(css.includes(selector),selector);
 assert(css.includes('--theme-base:#030509'));assert(css.includes('var(--theme-card)'));
 assert(!css.includes('img{'));assert(!css.includes('.rank-emblem img'));assert(!css.includes('.olaf-steam-discount'));
});
test('two dark palettes persist, synchronize tabs and retire white',async t=>{
 const w=new Window({url:'https://shop.example/profile.html'});t.after(()=>w.happyDOM.close());
 w.document.body.innerHTML='<header><div class="topbar-actions"></div></header>';
 w.eval(readFileSync(new URL('../site-theme.js',import.meta.url),'utf8'));
 w.document.body.insertAdjacentHTML('beforeend','<div class="site-theme-profile-control">'+w.OlafTheme.controlMarkup()+'</div>');
 await new Promise(r=>setTimeout(r,20));
 if(!w.document.querySelector('[data-site-theme-open]'))w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 w.document.querySelector('[data-site-theme-open]').click();
 const dialog=w.document.querySelector('.site-theme-dialog');assert(dialog.open);assert.equal(dialog.querySelectorAll('[data-site-theme-choice]').length,2);
 for(const theme of ['store','main']){dialog.querySelector(`[data-site-theme-choice="${theme}"]`).click();assert.equal(w.document.documentElement.dataset.siteTheme,theme);assert.equal(w.localStorage.getItem('olaf-site-theme'),theme);assert.equal(dialog.querySelectorAll('[aria-pressed=true]').length,1);}
 w.dispatchEvent(new w.StorageEvent('storage',{key:'olaf-site-theme',newValue:'light'}));assert.equal(w.document.documentElement.style.colorScheme,'dark');assert.equal(w.document.documentElement.dataset.siteTheme,'main');assert.equal(dialog.querySelector('[data-site-theme-choice=light]'),null);
 dialog.querySelector('[data-theme-close]').click();assert(!dialog.open);
 w.OlafTheme.set('invalid');assert.equal(w.document.documentElement.dataset.siteTheme,'main');
});

test('saved white preference migrates to blue before render',async t=>{
 const w=new Window({url:'https://shop.example/index.html'});t.after(()=>w.happyDOM.close());w.localStorage.setItem('olaf-site-theme','light');w.eval(readFileSync(new URL('../site-theme.js',import.meta.url),'utf8'));assert.equal(w.document.documentElement.dataset.siteTheme,'main');assert.equal(w.localStorage.getItem('olaf-site-theme'),'main');
});
test('all storefront pages load the picker after their base styles',()=>{
 for(const page of ['index.html','profile.html','product.html','more-products.html','free-games.html','free-random.html','point-topup.html','profile-store.html','login.html','register.html','public-profile.html','olaf-control.html']){
 const html=readFileSync(new URL('../'+page,import.meta.url),'utf8');assert.equal((html.match(/src="site-theme.js\?/g)||[]).length,1,page);assert(html.indexOf('site-theme-picker.css')>html.indexOf('site-theme-surfaces.css'),page);
 }
 const css=readFileSync(new URL('../site-theme-picker.css',import.meta.url),'utf8');assert(css.includes('html[data-site-theme=light]'));assert(css.includes('color-scheme:light'));assert(!css.includes('filter:invert'));assert(css.includes('prefers-reduced-motion'));
});
