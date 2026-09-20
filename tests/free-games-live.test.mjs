import test from 'node:test';
import assert from 'node:assert/strict';
import {parseEpicPromotions} from '../api/free-games.js';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(`${process.env.PGLITE_TEST_ROOT||process.cwd()}/package.json`);
const {Window}=await import(pathToFileURL(require.resolve('happy-dom')).href);
const now=Date.parse('2026-09-10T15:00:00Z');
const promotion=(start,end,discount=0)=>({startDate:start,endDate:end,discountSetting:{discountPercentage:discount}});
const item=(id,promos,price=0)=>({id,title:id,offerMappings:[{pageType:'productHome',pageSlug:'real-'+id}],productSlug:'old-'+id,price:{totalPrice:{discountPrice:price}},promotions:{promotionalOffers:[{promotionalOffers:promos}]}});
const feed=elements=>({data:{Catalog:{searchStore:{elements}}}});
test('API rejects writes, hides upstream failures, retries and caches successful reads',async t=>{
 const {default:handler}=await import('../api/free-games.js?handler-test');
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});let requests=0;
 globalThis.fetch=async()=>{requests++;throw new Error('private upstream detail');};
 const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(b){this.body=b;return this;}});
 let res=response();await handler({method:'POST'},res);assert.equal(res.code,405);assert.equal(requests,0);
 res=response();await handler({method:'GET'},res);assert.equal(res.code,502);assert.equal(res.body.error,'EPIC_UNAVAILABLE');assert(!JSON.stringify(res.body).includes('private'));
 globalThis.fetch=async()=>{requests++;return {ok:true,json:async()=>feed([])};};
 res=response();await handler({method:'GET'},res);assert.equal(res.code,200);assert.equal(res.body.country,'TH');assert.deepEqual(res.body.offers,[]);assert.equal(res.headers['Cache-Control'],'no-store');
 await handler({method:'GET'},response());assert.equal(requests,2);
});
test('Epic uses start-inclusive/end-exclusive time, confirmed zero price and real product mappings',()=>{
 const live=promotion('2026-09-10T15:00:00Z','2026-09-17T15:00:00Z');
 const data=parseEpicPromotions(feed([item('live',[live,live]),item('paid',[live],500),item('expired',[promotion('2026-09-03T15:00:00Z','2026-09-10T15:00:00Z')]),item('sale',[{...live,discountSetting:{discountPercentage:40}}]),item('next',[promotion('2026-09-17T15:00:00Z','2026-09-24T15:00:00Z')],100)]),now);
 assert.deepEqual(data.offers.map(x=>x.id),['epic-live']);assert.equal(data.offers[0].url,'https://store.epicgames.com/en-US/p/real-live');assert.equal(data.upcomingOffers.length,1);
 assert.throws(()=>parseEpicPromotions({}),/INVALID_EPIC_FEED/);assert.equal(parseEpicPromotions(feed([]),now).offers.length,0);
});
test('Epic moves a started promotion even if upstream still places it in upcoming groups',()=>{
 const i=item('moving',[]);i.promotions.upcomingPromotionalOffers=[{promotionalOffers:[promotion('2026-09-10T15:00:00Z','2026-09-17T15:00:00Z')]}];
 assert.equal(parseEpicPromotions(feed([i]),now-1).upcomingOffers.length,1);assert.equal(parseEpicPromotions(feed([i]),now).offers.length,1);
});
test('browser requests same-origin API, promotes timed fallback, clears empty success and reports failure truthfully',async t=>{
 const w=new Window({url:'https://shop.example/free-games.html'});t.after(()=>w.happyDOM.close());
 w.document.body.innerHTML='<div id="free-games-grid"></div><div id="free-games-upcoming-grid"></div><p id="free-games-last-checked"></p><p id="free-games-feed-status"></p><p id="free-games-curated-checked"></p><button id="free-games-refresh"></button>';
 const time=Date.now(),offer={id:'old',title:'Scheduled game',platform:'epic',startsAt:new Date(time-1000).toISOString(),endsAt:new Date(time+3600000).toISOString(),url:'https://store.epicgames.com/free-games'};
 w.OlafFreeGamesData={updatedAt:'2026-09-05',offers:[],upcomingOffers:[offer],platforms:[]};let mode='error',calls=0;
 w.fetch=async url=>{calls++;assert.equal(url,'/api/free-games');if(mode==='error')return {ok:false};return {ok:true,json:async()=>({offers:[],upcomingOffers:[],checkedAt:new Date().toISOString()})};};
 w.eval(readFileSync(new URL('../free-games.js',import.meta.url),'utf8'));await new Promise(r=>setTimeout(r,50));if(!calls){w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await new Promise(r=>setTimeout(r,30));}
 assert(w.document.querySelector('#free-games-grid').textContent.includes('Scheduled game'));assert(w.document.querySelector('#free-games-feed-status').textContent.includes('ข้อมูลเดิม'));assert(!w.document.querySelector('#free-games-last-checked').textContent.includes('ยืนยันล่าสุด'));
 mode='empty';w.document.querySelector('#free-games-refresh').click();await new Promise(r=>setTimeout(r,30));assert(!w.document.querySelector('#free-games-grid').textContent.includes('Scheduled game'));assert(w.document.querySelector('#free-games-last-checked').textContent.includes('ยืนยันล่าสุด'));
});
