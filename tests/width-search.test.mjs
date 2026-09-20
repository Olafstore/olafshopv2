import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../site-refinements.css',import.meta.url),'utf8');
test('activity shelf retains full width and outside controls have a narrow-screen fallback',()=>{
 assert(css.includes('.olaf-steam-activity-carousel{margin-inline:0;width:100%;'));
 assert(css.includes('.olaf-steam-activity-arrow.is-prev{left:-52px!important;}'));
 assert(css.includes('@media(min-width:761px) and (max-width:1499px)'));
});
test('profile search uses one shared form surface and a shrinking text field',()=>{
 assert(css.includes('#topbar-search-form{display:flex!important;'));
 assert(css.includes('#topbar-search-input{flex:1 1 auto!important;min-width:0!important;width:0!important;'));
 assert(css.includes('#topbar-search-form:focus-within'));
 for(const page of ['index','profile'])assert(readFileSync(new URL('../'+page+'.html',import.meta.url),'utf8').includes('site-refinements.css?v=20260912-width-search-v250'));
});
