import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../home-carousel-fade.css',import.meta.url),'utf8');
test('event carousel crossfades without translating and keeps inactive slides noninteractive',()=>{
 assert.match(css,/activity-track\{[^}]*transform:none!important/);
 assert.match(css,/opacity:0;visibility:hidden;pointer-events:none/);
 assert.match(css,/opacity:1;visibility:visible;pointer-events:auto/);
 assert.match(css,/opacity 180ms ease/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
test('mobile tags wrap at their natural width and event markers match highlight bars',()=>{
 assert.match(css,/olaf-steam-tags\{[^}]*flex-wrap:wrap/);
 assert.match(css,/flex:0 0 auto;width:auto;max-width:100%/);
 assert.match(css,/width:16px;height:9px;border-radius:2px/);
 assert.match(css,/is-active::before\{width:28px;background:#67bde9/);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert(html.indexOf('home-carousel-fade.css')>html.indexOf('site-refinements.css'));
});
