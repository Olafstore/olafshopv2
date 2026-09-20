import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
const require=createRequire(`${process.env.PGLITE_TEST_ROOT||process.cwd()}/package.json`);
const {Window}=await import(pathToFileURL(require.resolve('happy-dom')).href);
const source=readFileSync(new URL('../friends.js',import.meta.url),'utf8');
const wait=()=>new Promise(r=>setTimeout(r,25));
test('friend button, requests, activities, safe markup and pagination use authenticated RPCs',async t=>{
 const w=new Window({url:'https://olafshop.com/profile.html#user/PlayerAdmin'});t.after(()=>w.happyDOM.close());
 w.OlafProfileRoute={visiting:true,username:'PlayerAdmin'};
 w.document.body.innerHTML='<div id="profile-overview-root"><article class="member-visitor-showcase"></article></div>';
 w.OlafStore={ready:Promise.resolve(),currentUser:()=>({id:'viewer',displayName:'My Account'})};let relation='none',actions=[],lists=[];
 const timers=[];w.setTimeout=(fn,ms)=>{timers.push(ms);return 1;};w.clearTimeout=()=>{};
 w.olafSupabase={rpc:async(name,args)=>{
  if(name==='shop_friend_relation')return {data:{state:relation,online:relation==='friends'}};
  if(name==='shop_friend_action'){actions.push(args);relation=args.p_action==='request'?'outgoing':args.p_action==='accept'?'friends':'none';return {data:{state:relation}};}
  if(name==='shop_friend_heartbeat')return {data:{incoming:1,latestEventId:'4'}};
  if(name==='shop_friends_list'){
   lists.push(args);
   if(args.p_kind==='activity')return {data:[{id:'4',username:'PlayerAdmin',profileKey:'~admin-public-key',nickname:'<img onerror=x>',kind:'purchase',createdAt:'2026-09-09T00:00:00Z'}]};
   return {data:args.p_offset?[]:Array.from({length:11},(_,i)=>({username:'Friend'+i,profileKey:'~friend-key-'+i,nickname:'Friend '+i,online:true}))};
  }
  assert.fail(name);
 }};
 w.eval(source);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await wait();
 assert(timers.includes(45000));assert.equal(w.document.querySelector('.member-friend-bar [data-action]').dataset.action,'request');
 w.document.querySelector('.member-friend-bar button').click();await wait();
 assert.equal(actions[0].p_username,'PlayerAdmin');assert.equal(w.document.querySelector('.member-friend-bar [data-action]').dataset.action,'cancel');
 relation='incoming';w.dispatchEvent(new w.Event('olaf-member-profile-ready'));await wait();
 w.document.querySelector('.member-friend-bar [data-action="accept"]').click();await wait();
 assert(w.document.querySelector('.member-friend-bar .friend-online'));assert.equal(relation,'friends');
 assert.equal(w.document.querySelector('.member-friend-bar [data-chat-user]').dataset.chatUser,'PlayerAdmin');assert.equal(w.document.querySelector('.member-friend-bar [data-chat-user]').textContent,'แชท');
 w.document.querySelector('.friends-launch').click();await wait();
 assert(w.document.querySelector('[data-friends-self]').textContent.includes('My Account'));
 assert.equal(w.document.querySelector('[data-self-online]').textContent,'ออนไลน์');
 assert.equal(w.document.querySelector('.friends-request-alert').hidden,false);
 assert(w.document.querySelector('.friends-request-alert').textContent.includes('1 รายการ'));
 assert.equal(w.document.querySelectorAll('.friends-presence-group').length,2);
 assert.equal(w.document.querySelectorAll('.friends-recent a').length,5);
 assert.equal(w.document.querySelectorAll('.friend-person').length,10);assert.equal(w.document.querySelector('[data-more]').hidden,false);
 assert(w.document.querySelector('.friend-person a').href.endsWith('#user/~friend-key-0'));
 assert.equal(w.document.querySelector('.friend-person [data-action]').dataset.username,'~friend-key-0');
 w.document.querySelector('[data-more]').click();await wait();assert.equal(lists.at(-1).p_offset,10);
 w.document.querySelector('.friends-request-alert').click();await wait();assert.equal(lists.at(-1).p_kind,'incoming');
 w.document.querySelector('[data-tab="activity"]').click();await wait();
 assert(w.document.querySelector('.friend-activity').textContent.includes('สั่งซื้อสินค้าสำเร็จ'));
 assert(w.document.querySelector('.friend-activity a').href.endsWith('#user/~admin-public-key'));
 assert(!w.document.querySelector('[onerror]'));assert.equal(w.localStorage.getItem('olaf-friends-read:viewer'),'4');
 w.document.querySelector('[data-close]').click();assert.equal(w.document.querySelector('dialog').open,false);
});
test('guests have no heartbeat or private friend lists',async t=>{
 const w=new Window({url:'https://olafshop.com/profile.html#user/Other'});t.after(()=>w.happyDOM.close());
 w.OlafProfileRoute={username:'Other'};w.document.body.innerHTML='<div id="profile-overview-root"><article class="member-visitor-showcase"></article></div>';
 w.OlafStore={currentUser:()=>null};w.olafSupabase={rpc:()=>assert.fail('guest cannot update presence')};
 w.eval(source);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await wait();
 assert(w.document.querySelector('.member-friend-bar a'));assert(!w.document.querySelector('.friends-launch'));
});
test('friend controls sit below the profile cover and removal requires explicit confirmation',async t=>{
 const w=new Window({url:'https://olafshop.com/profile.html#user/~admin-key'});t.after(()=>w.happyDOM.close());
 w.OlafProfileRoute={username:'~admin-key'};w.OlafStore={currentUser:()=>({id:'viewer'})};
 w.document.body.innerHTML='<div id="profile-overview-root"><article class="member-visitor-showcase"><header class="member-cover"><h2>ADMIN</h2></header><div class="member-stats"></div></article></div>';
 const actions=[];let state='friends';w.setTimeout=()=>1;
 w.olafSupabase={rpc:async(name,args)=>{
  if(name==='shop_friend_relation')return {data:{state,online:true}};
  if(name==='shop_friend_action'){actions.push(args);state='none';return {data:{state}};}
  if(name==='shop_friend_heartbeat')return {data:{incoming:0}};
  if(name==='shop_friends_list')return {data:[{username:'same',nickname:'ADMIN',profileKey:'~admin-key'}]};
 }};
 w.eval(source);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await wait();
 assert(w.document.querySelector('.member-cover').nextElementSibling.matches('.member-friend-bar'));
 w.document.querySelector('.member-friend-bar [data-action="remove"]').click();await wait();
 assert.equal(actions.length,0);assert(w.document.querySelector('.friend-confirm').open);assert(w.document.querySelector('.friend-confirm strong').textContent.includes('ADMIN'));
 w.document.querySelector('[data-cancel]').click();await wait();assert.equal(actions.length,0);assert(!w.document.querySelector('.friend-confirm'));
 w.document.querySelector('.friends-launch').click();await wait();
 w.document.querySelector('.friend-person [data-action="remove"]').click();await wait();
 w.document.querySelector('[data-confirm-remove]').click();await wait();
 assert.deepEqual(JSON.parse(JSON.stringify(actions)),[{p_username:'~admin-key',p_action:'remove'}]);
 assert(w.document.querySelector('.member-friend-bar [data-action="request"]'));
});
test('desktop friend window drags and clamps to the viewport; mobile remains a non-draggable modal',async t=>{
 const w=new Window({url:'https://olafshop.com/index.html'});t.after(()=>w.happyDOM.close());
 let modeChange;const media={matches:true,addEventListener:(_,fn)=>modeChange=fn};w.matchMedia=()=>media;
 w.OlafStore={currentUser:()=>({id:'viewer'})};w.setTimeout=()=>1;
 w.olafSupabase={rpc:async name=>({data:name==='shop_friend_heartbeat'?{incoming:0}:[]})};
 w.eval(source);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await wait();
 const dialog=w.document.querySelector('.friends-dialog'),header=dialog.querySelector('header');
 let modalCalls=0,showCalls=0;const show=dialog.show.bind(dialog),showModal=dialog.showModal.bind(dialog);
 dialog.show=()=>{showCalls++;show();};dialog.showModal=()=>{modalCalls++;showModal();};
 header.setPointerCapture=()=>{};header.releasePointerCapture=()=>{};
 dialog.getBoundingClientRect=()=>({left:parseFloat(dialog.style.left)||20,top:parseFloat(dialog.style.top)||20,width:400,height:500});
 w.document.querySelector('.friends-launch').click();await wait();assert.equal(showCalls,1);assert.equal(modalCalls,0);assert(dialog.classList.contains('is-floating'));
 const pointer=(type,x,y,target=header)=>target.dispatchEvent(new w.PointerEvent(type,{bubbles:true,pointerId:1,pointerType:'mouse',button:0,clientX:x,clientY:y}));
 const initial=dialog.getBoundingClientRect();pointer('pointerdown',initial.left+10,initial.top+10);pointer('pointermove',300,160);
 assert.equal(dialog.style.left,'290px');assert.equal(dialog.style.top,'150px');
 pointer('pointermove',-100,-200);assert.equal(dialog.style.left,'12px');assert.equal(dialog.style.top,'12px');
 pointer('pointermove',9000,9000);assert.equal(parseFloat(dialog.style.left),w.innerWidth-412);assert.equal(parseFloat(dialog.style.top),w.innerHeight-512);
 pointer('pointerup',0,0);assert(!dialog.classList.contains('is-dragging'));
 pointer('pointerdown',30,30,dialog.querySelector('[data-close]'));assert(!dialog.classList.contains('is-dragging'));
 media.matches=false;modeChange();dialog.dispatchEvent(new w.Event('close'));await wait();assert.equal(modalCalls,1);assert(!dialog.classList.contains('is-floating'));assert.equal(dialog.style.left,'');
 assert(dialog.querySelector('[role="status"]').textContent.includes('ยังไม่มีเพื่อน'),'late close events must not cancel the newly opened mobile list');
 pointer('pointerdown',20,20);pointer('pointermove',200,200);assert.equal(dialog.style.left,'');assert(!dialog.classList.contains('is-dragging'));
});
test('presence pauses in hidden tabs and a changed account cannot keep the old friend panel open',async t=>{
 const w=new Window({url:'https://olafshop.com/index.html'});t.after(()=>w.happyDOM.close());
 let hidden=false,id='one',beats=0,timerCallback;
 Object.defineProperty(w.document,'hidden',{get:()=>hidden});
 w.OlafStore={currentUser:()=>id?{id}:null};
 w.setTimeout=fn=>{timerCallback=fn;return 1;};w.clearTimeout=()=>{};
 w.olafSupabase={rpc:async name=>{if(name==='shop_friend_heartbeat'){beats++;return {data:{incoming:0,latestEventId:'0'}};}return {data:[]};}};
 w.eval(source);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await wait();assert.equal(beats,1);
 hidden=true;w.document.dispatchEvent(new w.Event('visibilitychange'));await timerCallback();assert.equal(beats,1);
 hidden=false;w.document.dispatchEvent(new w.Event('visibilitychange'));await wait();assert.equal(beats,2);
 w.document.querySelector('.friends-launch').click();await wait();assert(w.document.querySelector('dialog').open);
 id=null;w.dispatchEvent(new w.Event('focus'));await wait();assert.equal(beats,2);assert(w.document.querySelector('.friends-launch').hidden);assert.equal(w.document.querySelector('dialog').open,false);
});
