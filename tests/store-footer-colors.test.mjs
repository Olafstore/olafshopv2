import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('store section overrides stay scoped and expose an active category',()=>{
 const css=read('profile-store-effects.css');
 assert.match(css,/body\.profile-store-page \.store-market \.store-toolbar\{background:transparent!important/);
 assert.match(css,/\.atelier-history\{background:#101114!important/);
 assert.match(css,/button\[aria-pressed=true\]/);
 assert.match(css,/summary\):focus-visible/);
});
test('footer uses theme tokens rather than a fixed navy or white background',()=>{
 const css=read('site-theme-surfaces.css');
 assert.match(css,/footer\.site-footer\{background:var\(--theme-base\)!important/);
 assert.match(css,/\.site-footer \.payment-badge\{background:var\(--theme-panel-end\)!important/);
 for(const page of ['index.html','product.html','profile.html','profile-store.html'])assert(read(page).includes('site-theme-surfaces.css?v=20260913-v255'));
 assert(read('profile-store-effects.js').includes('profile-store-effects.css?v=20260913-v255'));
});
