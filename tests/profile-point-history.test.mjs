import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
const require=createRequire(`${process.env.PGLITE_TEST_ROOT || process.cwd()}/package.json`);
const {Window}=await import(pathToFileURL(require.resolve('happy-dom')).href);
const flush=()=>new Promise(resolve=>setTimeout(resolve,10));
test('point history loads lazily, pages, filters and escapes ledger reasons',async t=>{
 const window=new Window({url:'https://shop.example/profile.html'});t.after(()=>window.happyDOM.close());
 const html=readFileSync(new URL('../profile.html',import.meta.url),'utf8');
 window.document.body.innerHTML=html.match(/<details class="shop-point-history"[\s\S]*?<\/details>/)[0];
 window.OlafStore={ready:Promise.resolve(),currentUser:()=>({id:'member-1'})};
 const calls=[];let fail=false;
 window.olafSupabase={from(table){const call={table};calls.push(call);const query={
  select(fields){call.fields=fields;return this;},eq(key,value){call.owner=[key,value];return this;},
  lte(key,value){call.cutoff=value;return this;},order(){return this;},
  gt(key,value){call.filter='earned';return this;},lt(key,value){call.filter='spent';return this;},
  async range(start,end){call.range=[start,end];if(fail)return {error:new Error('offline')};return {data:Array.from({length:start||call.filter?1:11},(_,i)=>({id:String(start+i),amount:call.filter==='spent'?-100:500,balance_after:1000,reason:'<img src=x onerror=alert(1)>',created_at:'2026-09-07T00:00:00Z'}))};}
 };return query;}};
 window.eval(readFileSync(new URL('../profile-point-history.js',import.meta.url),'utf8'));
 window.document.dispatchEvent(new window.Event('DOMContentLoaded'));await flush();
 assert.equal(calls.length,0);
 const root=window.document.querySelector('details');root.open=true;root.dispatchEvent(new window.Event('toggle'));await flush();
 assert.equal(root.querySelectorAll('article').length,10);
 assert.deepEqual(calls[0].owner,['user_id','member-1']);
 assert.deepEqual(calls[0].range,[0,10]);
 assert.equal(root.querySelector('img'),null);
 assert(root.textContent.includes('+500'));
 const more=root.querySelector('[data-shop-history-more]');assert.equal(more.hidden,false);more.click();await flush();
 assert.deepEqual(calls[1].range,[10,20]);assert.equal(root.querySelectorAll('article').length,11);assert.equal(more.hidden,true);
 const filter=root.querySelector('select');filter.value='spent';filter.dispatchEvent(new window.Event('change'));await flush();
 assert.equal(calls[2].filter,'spent');assert.deepEqual(calls[2].range,[0,10]);assert.equal(root.querySelectorAll('article').length,1);assert(root.textContent.includes('-100'));
 fail=true;root.querySelector('[data-shop-history-refresh]').click();await flush();
 assert(root.querySelector('[role=status]').textContent.includes('ไม่สำเร็จ'));assert.equal(filter.disabled,false);
});
