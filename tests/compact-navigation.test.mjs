import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const nav=readFileSync(new URL('../site-navigation.js',import.meta.url),'utf8');
test('shared desktop and mobile navigation use new labels without inventory',()=>{
 const items=nav.slice(nav.indexOf('const NAV_ITEMS = ['),nav.indexOf('function createDisplayTextCleaner'));
 assert(items.includes('label: "เติมเงิน"'));assert(items.includes('label: "สุ่มเกม"'));
 assert(!items.includes('คลังสินค้า'));assert(!items.includes('สุ่ม 1 Point'));
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const main=html.match(/<nav class="main-nav"[\s\S]*?<\/nav>/)[0];assert(!main.includes('#inventory'));assert(main.includes('เติมเงิน'));
});
test('both user menu renderers omit requested shortcuts but retain inventory and profile',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const menus=[nav.slice(nav.indexOf('      <div class="user-popover-menu">'),nav.indexOf('    const randomGameIcon')),
 app.slice(app.indexOf('function renderUserPopover()'),app.indexOf('function closeUserPopover()'))];
 for(const menu of menus){
  assert(!menu.includes('ข้อมูลส่วนตัว'));assert(!menu.includes('href="point-topup.html"'));assert(!menu.includes('href="profile.html#orders"'));assert(!menu.includes('href="free-random.html"'));
  assert(menu.includes('href="profile.html#inventory"'));assert(menu.includes('href="profile.html#overview"'));assert(menu.includes('href="profile-store.html"'));assert(menu.includes('คูปองของฉัน'));
 }
});
