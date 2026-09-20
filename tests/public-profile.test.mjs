import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
const require=createRequire(`${process.env.PGLITE_TEST_ROOT||process.cwd()}/package.json`);
const {Window}=await import(pathToFileURL(require.resolve('happy-dom')).href);
const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const id='11111111-1111-4111-8111-111111111111';
const flush=()=>new Promise(resolve=>setTimeout(resolve,20));
test('public route renders escaped allowlisted details using only the public RPC',async t=>{
 const w=new Window({url:`https://olafshop.com/profie/user?id=${id}`});t.after(()=>w.happyDOM.close());
 w.document.head.innerHTML='<base href="/">';w.document.body.innerHTML='<main id="public-profile-root"></main>';
 const calls=[];w.olafSupabase={rpc:async(name,args)=>{calls.push([name,args]);return {data:{displayName:'<img src=x onerror=alert(1)>',bio:'<script>unsafe</script>',rank:2,avatar:'iconprofile/a.gif',background:'iconprofile/BGolaf/a.gif',email:'PRIVATE',balance:99999,games:[{id:'a',name:'<b>Game</b>',image:'images/game.png'},{id:'b',name:'Another',image:'javascript:alert(1)'}]}};}};
 w.eval(source('public-profile.js'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await flush();
 assert(calls.every(c=>c[0]==='shop_view_public_profile'&&c[1].p_share_id===id));
 assert.equal(w.document.querySelectorAll('script,[onerror]').length,0);
 assert(w.document.querySelector('h1').textContent.includes('<img'));
 assert(!w.document.body.textContent.includes('PRIVATE'));assert(!w.document.body.textContent.includes('99999'));
 assert.equal(w.document.querySelector('.public-profile-games img').src,'https://olafshop.com/images/game.png');
 assert.equal(w.document.querySelectorAll('.public-profile-games img').length,1);
 assert(w.document.querySelector('.public-profile-avatar').src.includes('a.gif'));
 assert(w.document.querySelector('.public-profile-rank').src.endsWith('rank=gold'));
});
test('missing or revoked share cannot render profile details',async t=>{
 for(const query of ['',`?id=${id}`]){
  const w=new Window({url:'https://olafshop.com/profie/user'+query});t.after(()=>w.happyDOM.close());
  w.document.body.innerHTML='<main id="public-profile-root"></main>';let count=0;
  w.olafSupabase={rpc:async()=>{count++;return {data:null};}};
  w.eval(source('public-profile.js'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await flush();
  assert(w.document.body.textContent.includes('ไม่พบโปรไฟล์'));assert(!w.document.querySelector('.public-profile-card'));
  if(!query)assert.equal(count,0);
 }
});
test('sharing errors distinguish migration, permissions and ownership without exposing server details',async t=>{
 const w=new Window();t.after(()=>w.happyDOM.close());
 const code=source('profile-sharing.js');w.eval(code.slice(0,code.indexOf('  const icon='))+'window.testSharingError=sharingError;})();');
 for(const errorCode of ['PGRST202','42703','22P02','42501']){
  const text=w.testSharingError({code:errorCode,message:'PRIVATE customer@example.com',details:'SECRET'});
  assert(text.includes(errorCode));assert(!text.includes('PRIVATE'));assert(!text.includes('SECRET'));assert(!text.includes('@'));
 }
 assert(w.testSharingError({code:'P0001',message:'GAME_NOT_OWNED'}).includes('ตรวจสิทธิ์ไม่ผ่าน'));
 assert(w.testSharingError(new Error('Failed to fetch')).includes('ยังยืนยันผลการบันทึกไม่ได้'));
});
test('sharing requires consent, copies a random share URL, syncs selected games and revokes',async t=>{
 const w=new Window({url:'https://olafshop.com/profile.html'});t.after(()=>w.happyDOM.close());
 w.OlafStore={currentUser:()=>({id:'owner',email:'never@example.com'})};
 w.document.body.innerHTML='<div id="profile-overview-root"><section class="member-games"></section></div>';
 let settings={enabled:false,shareId:id,name:'สมาชิก OLAF',games:[]};const calls=[];
 w.olafSupabase={rpc:async(action,args)=>{calls.push([action,args]);if(args)settings={...settings,enabled:args.p_enabled,games:args.p_games,name:args.p_name};return {data:{...settings}};}};
 w.eval(source('profile-sharing.js'));
 w.dispatchEvent(new w.CustomEvent('olaf-profile-ready',{detail:{ordersLoaded:true,games:[{id:'a'},{id:'b'}]}}));await flush();
 assert.equal(calls.length,1);assert.equal(calls[0][0],'shop_public_profile_settings');
 const form=w.document.querySelector('form'),submit=()=>form.dispatchEvent(new w.Event('submit',{cancelable:true}));
 submit();await flush();assert.equal(calls.length,1,'no implicit opt-in');
 form.querySelector('[name=consent]').checked=true;form.querySelector('[name=public-name]').value='Nickname';submit();await flush();
 assert.equal(settings.enabled,true);assert.deepEqual(settings.games,['a','b']);
 assert.equal(w.document.querySelector('.member-share-link input').value,`https://olafshop.com/profie/user?id=${id}`);
 assert(!w.document.body.textContent.includes('never@example.com'));
 w.dispatchEvent(new w.CustomEvent('olaf-profile-games-changed',{detail:{userId:'owner',games:[]}}));await flush();assert.deepEqual(Array.from(settings.games),[]);
 w.document.querySelector('[data-revoke]').click();await flush();assert.equal(settings.enabled,false);assert(w.document.querySelector('.member-share-link').hidden);
 w.dispatchEvent(new w.CustomEvent('olaf-profile-games-changed',{detail:{userId:'owner',games:['b']}}));await flush();assert.equal(settings.enabled,false);
});
