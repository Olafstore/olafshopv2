import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
const require=createRequire(`${process.env.PGLITE_TEST_ROOT || process.cwd()}/package.json`);
const {Window}=await import(pathToFileURL(require.resolve('happy-dom')).href);
test('shop points belong to selected user form, never order heading',async t=>{
 const window=new Window({settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});t.after(()=>window.happyDOM.close());
 window.document.body.innerHTML=readFileSync(new URL('../olaf-control.html',import.meta.url),'utf8');
 const form=window.document.getElementById('user-form');
 assert(form.elements.shopPointAmount);assert(form.elements.shopPointNote);
 assert.equal(window.document.querySelectorAll('#admin-shop-point-editor').length,1);
 assert.equal(window.document.getElementById('grant-user-shop-points').closest('form'),form);
 assert.equal(window.document.getElementById('deduct-user-shop-points').closest('form'),form);
 assert.equal(window.document.getElementById('deduct-user-shop-points').type,'button');
 assert(!window.document.querySelector('#admin-order-editor #admin-shop-point-editor'));
});
