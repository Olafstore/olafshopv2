import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('friend window uses fixed portraits, distinct layers and Thai chat label',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const css=read('friends-layout.css');assert(css.includes('flex:0 0 40px!important'));assert(css.includes('object-fit:cover;object-position:center'));assert(css.includes('.friends-presence-group h4'));assert(css.includes('.friends-compact nav svg'));
 assert(!read('friends-social.js').includes('แชต'));assert(read('friends.js').includes("if(data.state==='friends')"));
 for(const page of ['index.html','profile.html','product.html']){const html=read(page);assert(html.indexOf('friends-layout.css')>html.indexOf('friends-premium.css'));}
});
