import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('all twelve pages load the audited Daylight layer after existing theme styles',()=>{
 for(const page of ['index','profile','product','more-products','free-games','free-random','point-topup','profile-store','login','register','public-profile','olaf-control']){
  const html=read(page+'.html');
  assert.equal((html.match(/href="site-theme-light\.css/g)||[]).length,1,page);
  assert(html.indexOf('site-theme-light.css')>html.indexOf('site-theme-picker.css'),page);
 }
});
test('Daylight covers nested page and friend surfaces without recoloring artwork globally',()=>{
 const css=read('site-theme-light.css');
 for(const cls of ['extras-hero-copy','extras-usage-accordion','point-topup-copy','point-topup-status','free-random-viewport','free-random-machine','free-random-prizes','public-profile-games','profile-sidebar-card','site-cart-dialog','atelier-dialog','friends-self-menu','friends-request-alert','payment-badge','discord-floating-link','olaf-steam-store-loading'])assert(css.includes('.'+cls),cls);
 assert(!css.includes('filter:invert'));
 assert(css.includes('.public-profile-cover,.extras-branded-hero'));
 assert(css.includes('html[data-site-theme=light]'));
});
