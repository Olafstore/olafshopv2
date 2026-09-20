import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const window={};vm.runInNewContext(fs.readFileSync(new URL('../extra-products.js',import.meta.url),'utf8'),{window});
const catalog=window.OlafExtraProducts;
test('Office drafts use Windows delivery category without fabricated price or stock',()=>{
 const items=catalog.products.filter(p=>p.id.startsWith('microsoft-office-'));assert.equal(items.length,2);
 for(const p of items){assert.equal(p.category,'windows');assert.equal(p.price,0);assert.equal(p.stock,0);assert.equal(p.isActive,false);assert(p.delivery.includes('แอดมิน'));assert(p.tags.includes('Office 2024'));assert(!catalog.mergeProducts([]).some(x=>x.id===p.id));}
});
test('admin published Office price and stock override defaults',()=>{
 const p=catalog.products.find(p=>p.id.startsWith('microsoft-office-'));
 const merged=catalog.mergeProducts([{id:p.id,name:p.name,category:'windows',price:499,stock:7,isActive:true}])[0];
 assert.equal(merged.price,499);assert.equal(merged.stock,7);assert.equal(merged.image,'assets/office-2024.svg');assert.equal(merged.featureBlocks[1].title,'แอดมินส่งคีย์');
 assert(fs.readFileSync(new URL('../supabase-office-2024-drafts.sql',import.meta.url),'utf8').includes('on conflict(id) do nothing'));
});
