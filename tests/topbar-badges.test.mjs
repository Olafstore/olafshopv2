import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
const require=createRequire(`${process.env.PGLITE_TEST_ROOT || process.cwd()}/package.json`);
const {Window}=await import(pathToFileURL(require.resolve('happy-dom')).href);
test('notification badge hides zero and caps long counts without losing accessible total',async t=>{
 const w=new Window();t.after(()=>w.happyDOM.close());
 w.document.body.innerHTML='<button id="open-notifications"><span id="notification-badge" hidden></span></button>';
 const source=readFileSync(new URL('../notifications.js',import.meta.url),'utf8');
 w.eval(source.slice(source.indexOf('  function setBadge('),source.indexOf('  function markDeliveryNotificationRead('))+'\nwindow.testBadge=setBadge;');
 for(const [count,label] of [[1,'1'],[9,'9'],[10,'10'],[99,'99'],[100,'99+'],[10000,'99+']]){
  w.testBadge(count);assert.equal(w.document.querySelector('span').textContent,label);assert.equal(w.document.querySelector('span').hidden,false);assert(w.document.querySelector('button').getAttribute('aria-label').includes(String(count)));
 }
 w.testBadge(0);assert(w.document.querySelector('span').hidden);
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert(css.includes('body .topbar .favorites-button .favorites-badge[hidden] {display:none!important;}'));
});
