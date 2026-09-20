import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
const require=createRequire(`${process.env.PGLITE_TEST_ROOT||process.cwd()}/package.json`);
const {Window}=await import(pathToFileURL(require.resolve('happy-dom')).href);
const source=readFileSync(new URL('../profile-level.js',import.meta.url),'utf8');
const wait=()=>new Promise(r=>setTimeout(r,20));
test('own and visited names display server level and never mix the two accounts',async t=>{
 for(const visiting of [false,true]){
  const w=new Window({url:'https://olafshop.com/profile.html'});t.after(()=>w.happyDOM.close());
  w.document.body.innerHTML='<div id="profile-overview-root"><div class="member-identity"><h2>ADMIN<img alt="rank"></h2></div></div>';
  w.OlafProfileRoute={visiting,username:'~public-target'};w.OlafStore={currentUser:()=>({id:'viewer'})};
  let calls=0;w.olafSupabase={rpc:async(name,args)=>{calls++;assert.equal(name,visiting?'shop_member_level':'shop_my_level');if(visiting)assert.equal(args.p_profile_key,'~public-target');return {data:{level:21,progress:45.5,step:100}};}};
  w.eval(source);w.dispatchEvent(new w.Event(visiting?'olaf-member-profile-ready':'olaf-profile-ready'));await wait();
  assert.equal(w.document.querySelector('.profile-level-ring').textContent,'21');assert.equal(w.document.querySelector('.profile-level').style.getPropertyValue('--level-progress'),'45.5%');
  w.dispatchEvent(new w.Event('olaf-profile-ready'));await wait();assert.equal(w.document.querySelectorAll('[data-profile-level]').length,1);assert.equal(calls,2);
 }
});
test('level failures show unavailable, not a fabricated level zero',async t=>{
 const w=new Window();t.after(()=>w.happyDOM.close());w.document.body.innerHTML='<div id="profile-overview-root"><div class="member-identity"><h2>User</h2></div></div>';
 w.OlafStore={currentUser:()=>({id:'viewer'})};w.olafSupabase={rpc:async()=>({error:new Error('missing migration')})};w.eval(source);w.dispatchEvent(new w.Event('olaf-profile-ready'));await wait();
 assert.equal(w.document.querySelector('.profile-level-ring').textContent,'—');
});
test('ring hue progresses gradually with lifetime level and fractional progress',async t=>{
 const w=new Window();t.after(()=>w.happyDOM.close());w.document.body.innerHTML='<div id="profile-overview-root"><div class="member-identity"><h2>User</h2></div></div>';
 w.OlafStore={currentUser:()=>({id:'viewer'})};let level=0,progress=0;
 w.olafSupabase={rpc:async()=>({data:{level,progress,step:100}})};w.eval(source);
 const hue=async()=>{w.dispatchEvent(new w.Event('olaf-profile-ready'));await wait();return Number(w.document.querySelector('.profile-level').style.getPropertyValue('--level-hue'));};
 assert.equal(await hue(),12);progress=99;const before=await hue();level=1;progress=0;const after=await hue();assert(after>before&&after-before<.1);
 level=50;assert.equal(await hue(),192);level=100;assert.equal(await hue(),372);
});
