import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import rankImage from '../api/rank-image.js';
const require=createRequire(`${process.env.PGLITE_TEST_ROOT || process.cwd()}/package.json`);
const {Window}=await import(pathToFileURL(require.resolve('happy-dom')).href);
const source=readFileSync(new URL('../profile-rank.js',import.meta.url),'utf8');
test('rank animation waits for visible profile and is claimed only once per upgrade',async t=>{
  const window=new Window({url:'https://shop.example/profile.html#info',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
  t.after(()=>window.happyDOM.close());
  window.document.body.innerHTML='<section id="panel-overview"><div id="profile-overview-root"><header class="member-cover"><div id="profile-rank-root"></div></header><div data-profile-rank-controls-slot></div></div></section>';
  const state={rank:2,seen:0,total:550,month:'2026-09-01',resetsAt:'2099-10-01T00:00:00+07:00'};
  const claims=[];
  window.OlafStore={ready:Promise.resolve(),currentUser:()=>({id:'member'})};
  window.olafSupabase={rpc:async(name,args)=>{
    if(name==='shop_rank_state') return {data:{...state}};
    if(name==='shop_rank_badge_state') return {data:{rank:state.rank,show:false}};
    if(name==='shop_set_rank_display') return {data:{rank:state.rank,show:args.p_show}};
    claims.push(args); const animate=state.rank>state.seen; state.seen=state.rank;
    return {data:{animate,state:{...state}}};
  }};
  window.eval(source); window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  const flush=async()=>{await new Promise(resolve=>setTimeout(resolve,10));};
  await flush(); assert.equal(claims.length,0);
  window.document.getElementById('panel-overview').classList.add('is-active');
  window.dispatchEvent(new window.Event('hashchange')); await flush();
  assert.equal(claims.length,1);
  assert.equal(window.document.querySelectorAll('.rank-emblem').length,6);
  assert(window.document.querySelector('.is-current').textContent.includes('Gold'));
  assert(window.document.querySelector('.rank-up'));
  assert(window.document.querySelector('.member-cover .rank-track'));
  assert.equal(window.document.querySelector('.member-cover .rank-display-toggle'),null);
  assert(window.document.querySelector('[data-profile-rank-controls-slot] .rank-progress'));
  assert(window.document.querySelector('[data-profile-rank-controls-slot] .rank-display-toggle'));
  const emblems=[...window.document.querySelectorAll('.rank-emblem')];
  assert.equal(emblems[1].style.getPropertyValue('--rank-opacity'),'1');
  assert.equal(emblems[0].style.getPropertyValue('--rank-opacity'),'0.85');
  let painted;
  window.OlafRankBadge={update:data=>painted=data};
  const checkbox=window.document.querySelector('[data-rank-display]');
  checkbox.checked=true; checkbox.dispatchEvent(new window.Event('change',{bubbles:true})); await flush();
  assert.equal(painted.show,true);
  window.dispatchEvent(new window.Event('focus')); await flush();
  assert.equal(claims.length,1); assert(!window.document.querySelector('.rank-up'));
  assert.equal(window.document.querySelectorAll('#profile-rank-controls').length,1);
  state.rank=3; state.total=901;
  window.dispatchEvent(new window.Event('focus')); await flush();
  assert.equal(claims.length,2); assert(window.document.querySelector('.rank-up').textContent.includes('Platinum'));
});
test('opt-in rank badge appears after both names without duplicates and disappears when disabled',async t=>{
  const window=new Window({url:'https://shop.example/profile.html',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
  t.after(()=>window.happyDOM.close());
  window.document.body.innerHTML='<div class="member-identity"><h2>ADMIN</h2></div><div class="user-popover-info"><strong>ADMIN</strong></div>';
  window.OlafStore={currentUser:()=>({id:'one'})};
  const nav=readFileSync(new URL('../site-navigation.js',import.meta.url),'utf8');
  window.eval(nav.slice(0,nav.indexOf('  const ORDER_DESTINATION'))+'})();');
  window.OlafRankBadge.update({show:true,rank:2});
  window.OlafRankBadge.update({show:true,rank:2});
  assert.equal(window.document.querySelectorAll('[data-member-rank="gold"]').length,2);
  assert.equal(window.document.querySelector('h2').firstChild.textContent,'ADMIN');
  assert.equal(window.document.querySelector('.rank-badge-label').textContent,'Rank · gold');
  window.OlafRankBadge.update({show:false,rank:2});
  assert.equal(window.document.querySelectorAll('[data-member-rank]').length,0);
});

test('all six original rank pictures are served as small valid WebP; path traversal rejected',async()=>{
  const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},end(body){this.body=body;return this;}});
  for(const id of ['brone','gold','platinum','diamonds','super','supreme']) {
    const res=response(); await rankImage({method:'GET',url:`/api/rank-image?rank=${id}`,headers:{}},res);
    assert.equal(res.code,200);
    assert(res.body.length<100000);
    const metadata=await sharp(res.body).metadata(); assert.equal(metadata.format,'webp'); assert(metadata.width<=256);
  }
  const res=response(); await rankImage({method:'GET',url:'/api/rank-image?rank=../secret',headers:{}},res); assert.equal(res.code,404);
});
