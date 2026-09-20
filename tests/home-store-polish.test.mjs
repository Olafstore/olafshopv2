import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sample,storefront} from './storefront-fixture.mjs';
test('spotlight neighbors use the exact previous and next products and wrap at ends',()=>{
 const app=storefront(),html=app.steamSpotlightMarkup(sample[0],sample);
 assert.match(html,/spotlight-neighbor is-prev[^]*?src="\/art\/7"/);
 assert.match(html,/spotlight-neighbor is-next[^]*?src="\/art\/1"/);
 assert.equal((html.match(/class="spotlight-neighbor /g)||[]).length,2);
 assert(!app.steamSpotlightMarkup(sample[0],[sample[0]]).includes('class="spotlight-neighbor'));
 assert(!html.includes('<span>UTOPIA</span>'));
});
test('section alignment, landscape neighbors and visible controls avoid the v239 regressions',()=>{
 const css=readFileSync(new URL('../home-store-polish.css',import.meta.url),'utf8');
 assert(css.includes('> header.olaf-steam-section-head{width:'));
 assert(!css.includes('#olaf-steam-storefront .olaf-steam-section-head{width:'));
 assert(css.includes('height:92%;width:auto;aspect-ratio:16/9'));
 assert.match(css,/olaf-steam-activity-row\{background:none[^}]*overflow:visible/);
 assert(css.includes('max-width:none;width:100%;margin-inline:0'));
 assert.match(css,/\.stats-strip\{[^}]*background:transparent!important/);
 assert(css.includes('.olaf-steam-activity-arrow)::before'));
 assert(css.includes('.olaf-steam-spotlight-stage{width:100%;max-width:none;margin-inline:0;'));
 assert(css.includes('> header.olaf-steam-section-head{width:100%;max-width:none;margin-inline:0;}'));
 assert(!css.includes('width:calc(100% - 140px)'));
});
test('event shelf has four tiles in every slide without duplicates and makes hidden slides inert',()=>{
 const app=storefront(),slides=app.steamActivitySlides(sample);
 assert.deepEqual(Array.from(slides,s=>s.length),[4,4,4,4]);
 slides.forEach(s=>assert.equal(new Set(s.map(p=>p.id)).size,s.length));
 const html=app.steamActivityCarouselMarkup(sample);assert.equal((html.match(/aria-hidden="true" inert/g)||[]).length,3);assert(!html.includes('is-slot-5'));
 assert.equal(app.steamActivitySlides([]).length,0);
});
test('flat shelf and matching favorites styles load after the shared theme',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert(html.indexOf('home-store-polish.css')>html.indexOf('site-theme-surfaces.css'));
 const css=readFileSync(new URL('../home-store-polish.css',import.meta.url),'utf8');assert(css.includes('button.favorites-button'));assert(css.includes('border-radius:9px!important'));assert(css.includes('olaf-steam-activity-card::after{display:none'));
});
