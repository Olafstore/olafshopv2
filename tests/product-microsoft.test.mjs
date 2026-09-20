import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {renderProduct} from '../api/product-page.js';
const source=readFileSync(new URL('../product.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../product-microsoft.css',import.meta.url),'utf8');
const hero=source.slice(source.indexOf('function brandedProductHero('),source.indexOf('function ',source.indexOf('function brandedProductHero(')+10));
test('Microsoft sections float without outlines and preserve background blur',()=>{
 assert.match(css,/\.pd-bg-backdrop\s*\{[^}]*display:block!important[^}]*filter:blur\(40px\)/);
 for(const selector of ['.pd-brand-hero-windows','.pd-section']){
  const rule=css.slice(css.indexOf(selector+' {')).split('}')[0];
  assert(rule.includes('border:0!important'),selector);
  assert(rule.includes('background:transparent!important'),selector);
 }
 assert.match(css,/\.pd-related-card\s*\{[^}]*border:0!important[^}]*backdrop-filter:blur\(16px\)/);
 assert(css.includes('.pd-package-option.is-selected {border-color:#4aa8ef!important'));
});
test('Microsoft information card uses a subtle transparent border and glass surface',()=>{
 const rule=css.slice(css.indexOf('.pd-info-card {')).split('}')[0];
 assert(rule.includes('border:1px solid rgba(185,215,244,.18)!important'));
 assert(rule.includes('rgba(156,207,255,.055)'));
 assert(rule.includes('backdrop-filter:blur(12px)'));
 assert(rule.includes('padding:8px 22px!important'));
 assert(css.includes('padding:6px 16px!important'));
});
test('Microsoft detail header distinguishes Office and Windows and explains manual delivery',()=>{
 const context={isWindowsProduct:p=>p.category==='windows'};
 vm.createContext(context);vm.runInContext(hero,context);
 for(const [id,title] of [['microsoft-office-ltsc-professional-plus-2024','Microsoft Office'],['windows-11-pro','Microsoft Windows']]){
  const html=context.brandedProductHero({id,category:'windows'});
  assert(html.includes(`<h2>${title}</h2>`));
  assert(html.includes('รับคีย์จากแอดมิน'));
  assert.equal((html.match(/<li>/g)||[]).length,3);
  assert(!html.includes('PRE-ORDER LICENSE'));
 }
});
test('Microsoft styles ship in static and server-rendered detail pages',()=>{
 for(const html of [readFileSync(new URL('../product.html',import.meta.url),'utf8'),renderProduct({id:'windows-11-pro',name:'Windows 11 Pro'})]){
  assert(html.indexOf('product-microsoft.css')>html.indexOf('product-surface-fix.css'));
  assert(html.includes('product.js?v=20260919-admin-tags-v271'));
 }
 assert(css.includes('product-theme-windows'));
 assert(css.includes('object-fit:contain!important'));
 assert(css.includes('aspect-ratio:16/9!important;height:auto!important;min-height:0!important'));
 assert(css.includes('aspect-ratio:auto!important'));
 assert(css.includes('object-position:center;transform:none!important'));
 assert(css.includes('@media(max-width:760px)'));
 assert(css.includes('prefers-reduced-motion:reduce'));
});
