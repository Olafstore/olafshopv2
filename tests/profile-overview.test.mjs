import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../profile-overview.js',import.meta.url),'utf8');
test('profile collection includes paid games once, never topups or failed purchases',()=>{
  const ctx=vm.createContext({});
  vm.runInContext(source.slice(source.indexOf('function purchasedGames('),source.indexOf("document.addEventListener('DOMContentLoaded'")),ctx);
  const result=ctx.purchasedGames([
    {status:'pending',items:[{productId:'unpaid'}]},
    {status:'refunded',paymentStatus:'verified',items:[{productId:'refund'}]},
    {status:'delivered',items:[{productId:'point-topup'},{productId:'game',productName:'Game',password:'secret'}]},
    {paymentStatus:'verified',items:[{productId:'game'},{productId:'another'}]}
  ]);
  assert.deepEqual(Array.from(result,item=>item.id),['game','another']);
  assert(!JSON.stringify(result).includes('secret'));
});
