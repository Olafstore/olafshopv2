import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const html=fs.readFileSync(new URL('../profile.html',import.meta.url),'utf8');
const segment=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
test('inventory excludes top-ups and mixed-order top-up lines without changing order history',()=>{
  const ctx=vm.createContext({profileState:{},window:{},unpaidOrderExpiresAt:()=>null,normalizeInventoryText:v=>v||'',productNames:()=>'',inventoryPlatformLabel:()=>'',inventoryTypeLabel:()=>'',orderStatusLabel:()=>'',inventoryPreview:()=>'',extractPrimaryCopy:()=>''});
  vm.runInContext(segment('function isPointTopupOrder(', 'function orderDisplayStatusLabel(')+segment('function collectInventoryRows(', 'function renderInventoryCard('),ctx);
  const orders=[{id:'topup',status:'confirmed',items:[{productId:'point-topup'}]},{id:'mixed',status:'confirmed',items:[{product_id:'point-topup'},{productId:'game',productName:'Game'}]},{id:'game',status:'delivered',items:[{productId:'game2',productName:'Game 2'}]}];
  const original=JSON.stringify(orders);
  const rows=ctx.collectInventoryRows(orders,[]);
  assert.equal(rows.length,2);
  assert(rows.every(row=>row.productId!=='point-topup'));
  assert.equal(JSON.stringify(orders),original);
});
test('profile wording and load-more label match the requested copy',()=>{
  const shop=fs.readFileSync(new URL('../profile-shop.js',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
  assert(shop.includes('<h2>Profile</h2><p>ตกแต่งโปรไฟล์สไตล์คุณ</p>'));
  assert(shop.includes('<p>เติมเงินสำเร็จ 100 บาท = 1,000 แต้ม</p>'));
  assert(app.includes('data-discovery-more>โหลดเกมเพิ่ม</button>'));
  assert(!app.includes('data-discovery-progress'));
});
