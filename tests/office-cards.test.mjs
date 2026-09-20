import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../more-products.js',import.meta.url),'utf8');
const context={window:{},escapeHtml:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),formatPrice:n=>'฿'+n};
vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  function officeProductCard('),source.indexOf('  async function loadExtraProducts(')),context);
test('Office tags come only from admin, preserve text and escape HTML',()=>{
 const product={id:'microsoft-office-professional-plus-2024',name:'Office',tags:['Custom <tag>','Retail','']};
 const html=context.officeProductCard(product);
 assert(html.includes('<span>Custom &lt;tag&gt;</span><span>Retail</span>'));
 assert(!html.includes('<span>Professional Plus</span>'));
 assert(!context.officeProductCard({...product,tags:[]}).includes('office-license-tags'));
});
test('only the two Office IDs receive horizontal Microsoft cards and retain admin prices',()=>{
 for(const id of ['microsoft-office-professional-plus-2024','microsoft-office-ltsc-professional-plus-2024']){
  const html=context.windowsProductCard({id,name:'Office <2024>',price:450,compareAt:600,stock:3,gallery:['/custom-cover.png']});
  assert(html.includes('office-license-card'));assert(html.includes('Office &lt;2024&gt;'));assert(html.includes('฿450'));assert(html.includes('/custom-cover.png'));assert(html.includes('สั่งซื้อเลย'));assert(html.includes('product.html?id='+id));
 }
 const other=context.windowsProductCard({id:'windows-11-pro',name:'Windows 11 Pro',price:199,stock:3});assert(!other.includes('office-license-card'));
 const empty=context.windowsProductCard({id:'microsoft-office-professional-plus-2024',name:'Office',price:0,stock:0});assert(empty.includes('ดูรายละเอียด'));assert(!empty.includes('สั่งซื้อเลย'));
});
test('Office art stays uncropped with a full-width 16:9 panel',()=>{
 const css=fs.readFileSync(new URL('../office-cards.css',import.meta.url),'utf8');assert(css.includes('object-fit:contain'));assert(css.includes('grid-column:span 2'));assert(css.includes('@media(max-width:600px)'));assert(css.includes('grid-template-columns:minmax(90px,.75fr) minmax(0,1.4fr)'));
});
test('final Office media layout is independent of text height',()=>{
 const css=fs.readFileSync(new URL('../office-cards.css',import.meta.url),'utf8').split('/* 1920 x 1080 composition:')[1];
 assert(css.includes('grid-template-columns:minmax(0,1fr)'));
 assert(css.includes('aspect-ratio:16/9;height:auto;min-height:0'));
 assert(css.includes('transform:none!important'));
});
test('Office media resets inherited button styling and actions use fixed-size SVG icons',()=>{
 const css=fs.readFileSync(new URL('../office-cards.css',import.meta.url),'utf8');
 assert.match(css,/office-license-card>a\.office-license-art\{[^}]*padding:0[^}]*background:#fff!important;box-shadow:none!important/);
 assert.match(css,/\.office-license-action\{[^}]*width:auto/);
 assert.match(css,/office-license-action svg\{[^}]*width:18px;height:18px/);
 const html=context.windowsProductCard({id:'microsoft-office-professional-plus-2024',name:'Office',price:0,stock:0});
 assert.match(html,/class="office-license-action"><svg[^]*?<span>ดูรายละเอียด<\/span>/);assert(!html.includes('↗'));
});
test('Office hover is mouse-only and reduced motion disables transforms',()=>{
 const css=fs.readFileSync(new URL('../office-cards.css',import.meta.url),'utf8');
 assert(css.includes('@media(hover:hover) and (pointer:fine)'));
 assert(css.includes('transform:translateY(-4px)'));
 assert(css.includes('transform:scale(1.015)'));
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)[^]*transition:none!important;animation:none!important;transform:none!important/);
});
