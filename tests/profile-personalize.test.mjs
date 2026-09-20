import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
const require=createRequire(`${process.env.PGLITE_TEST_ROOT || process.cwd()}/package.json`);
const {Window}=await import(pathToFileURL(require.resolve('happy-dom')).href);
test('personalization moves bio, stores account theme and caps selected games at twelve',async t=>{
 const window=new Window({url:'https://shop.example/profile.html'});t.after(()=>window.happyDOM.close());
 window.OlafStore={currentUser:()=>({id:'test'})};
 window.olafSupabase={rpc:async(name,args)=>({data:{games:name==='shop_save_profile_showcase'?args.p_games:null}})};
 window.document.body.innerHTML='<div id="profile-overview-root"><header class="member-cover"><div class="member-identity"><div><h2>User</h2><p>Old</p></div></div></header><div class="member-bio"><h3>Bio</h3><p data-bio-text>Hello</p></div><section class="member-games"><h3>Games</h3><div class="member-game-grid"></div></section></div>';
 window.eval(readFileSync(new URL('../profile-personalize.js',import.meta.url),'utf8'));
 window.dispatchEvent(new window.CustomEvent('olaf-profile-ready',{detail:{ordersLoaded:true,games:Array.from({length:20},(_,i)=>({id:String(i),name:'Game '+i}))}}));
 await new Promise(resolve=>setTimeout(resolve,15));
 const root=window.document.getElementById('profile-overview-root');
 assert(root.querySelector('.member-identity [data-bio-text]'));
 assert.equal(root.querySelectorAll('.member-game-grid a').length,0,'never show an unsaved default six games as public');
 const theme=root.querySelector('select');theme.value='store';theme.dispatchEvent(new window.Event('change'));
 assert.equal(JSON.parse(window.localStorage.getItem('olaf-profile-layout:test')).theme,'store');
 root.querySelector('.member-select-games').click();
 const dialog=window.document.querySelector('dialog'),checks=[...dialog.querySelectorAll('input')];
 checks.slice(0,12).forEach(check=>check.checked=true);dialog.dispatchEvent(new window.Event('change'));
 assert(checks[12].disabled);
 dialog.querySelector('form').dispatchEvent(new window.Event('submit',{cancelable:true}));
 await new Promise(resolve=>setTimeout(resolve,15));
 assert.equal(root.querySelectorAll('.member-game-grid a').length,12);
 root.querySelector('.member-select-games').click();
 const emptyDialog=window.document.querySelector('dialog');
 emptyDialog.querySelectorAll('input').forEach(check=>check.checked=false);
 emptyDialog.querySelector('form').dispatchEvent(new window.Event('submit',{cancelable:true}));
 await new Promise(resolve=>setTimeout(resolve,15));
 assert.equal(root.querySelectorAll('.member-game-grid a').length,0);
 assert.deepEqual(JSON.parse(window.localStorage.getItem('olaf-profile-layout:test')).games,[]);
});
test('legacy selections import once, server selections win, and sync errors remain visible',async t=>{
 const fixture='<div id="profile-overview-root"><header class="member-cover"><div class="member-identity"><div><h2>User</h2></div></div></header><section class="member-games"><h3>Games</h3><div class="member-game-grid"></div></section></div>';
 for(const scenario of ['legacy','server-empty','server-chosen','read-failure','import-failure','no-selection']){
  const w=new Window({url:'https://shop.example/profile.html#user'});t.after(()=>w.happyDOM.close());
  w.OlafStore={currentUser:()=>({id:'owner'})};w.document.body.innerHTML=fixture;
  if(scenario!=='no-selection')w.localStorage.setItem('olaf-profile-layout:owner',JSON.stringify({games:['a','b']}));
  const calls=[];w.olafSupabase={rpc:async(name,args)=>{
   calls.push([name,args]);
   if(name==='shop_profile_showcase_state')return scenario==='read-failure'?{error:{code:'PGRST202'}}:{data:{games:scenario==='server-empty'?[]:scenario==='server-chosen'?['b']:null}};
   if(name==='shop_import_profile_showcase')return scenario==='import-failure'?{error:{code:'PGRST202'}}:{data:{games:['a','b']}};
   assert.fail(name);
  }};
  w.eval(readFileSync(new URL('../profile-personalize.js',import.meta.url),'utf8'));
  w.dispatchEvent(new w.CustomEvent('olaf-profile-ready',{detail:{ordersLoaded:true,games:[{id:'a',name:'Game A'},{id:'b',name:'Game B'}]}}));
  await new Promise(resolve=>setTimeout(resolve,15));
  const count=w.document.querySelectorAll('.member-game-grid a').length;
  if(scenario==='legacy'){assert.equal(count,2);assert.equal(calls[1][0],'shop_import_profile_showcase');assert.deepEqual(Array.from(calls[1][1].p_games),['a','b']);}
  if(scenario==='server-empty'){assert.equal(count,0);assert.equal(calls.length,1,'explicit zero must never import stale local games');}
  if(scenario==='server-chosen'){assert.equal(count,1);assert(w.document.querySelector('.member-game-grid').textContent.includes('Game B'));assert.equal(calls.length,1);}
  if(scenario==='read-failure'||scenario==='import-failure'){assert(w.document.querySelector('[data-showcase-sync-status]').textContent.includes('ยังยืนยันรายการบนเว็บไม่ได้'));assert.deepEqual(JSON.parse(w.localStorage.getItem('olaf-profile-layout:owner')).games,['a','b']);}
  if(scenario==='no-selection'){assert.equal(count,0);assert.equal(calls.length,1);assert.equal(JSON.parse(w.localStorage.getItem('olaf-profile-layout:owner')).games,null);}
 }
});
