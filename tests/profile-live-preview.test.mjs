import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(`${process.env.PGLITE_TEST_ROOT||process.cwd()}/package.json`);
const {Window}=await import(pathToFileURL(require.resolve('happy-dom')).href);
test('preview uses the real profile, replaces only draft art and cleans up on close',async t=>{
 const w=new Window({url:'https://shop.example/profile-store.html',settings:{disableIframePageLoading:true}}),child=new Window({url:'https://shop.example/profile.html'});t.after(()=>{w.happyDOM.close();child.happyDOM.close();});
 w.document.documentElement.dataset.siteTheme='light';
 child.document.body.innerHTML='<header>Navigation</header><main><aside>Private sidebar</aside><section><div id="profile-overview-root"><article><header class="member-cover"><img class="member-background" src="/saved.png"><div class="member-identity"><h2>REAL NAME <span data-profile-level>42</span></h2></div></header><div class="member-stats">12 games · 500 Points</div><section class="member-games">Selected games</section></article></div></section></main>';
 w.document.body.innerHTML='<dialog open><div id="host"></div></dialog>';w.ResizeObserver=class{observe(){}disconnect(){}};
 const create=w.document.createElement.bind(w.document);w.document.createElement=(name,...args)=>{const e=create(name,...args);if(name==='iframe')Object.defineProperty(e,'contentDocument',{value:child.document});return e;};
 w.eval(readFileSync(new URL('../profile-live-preview.js',import.meta.url),'utf8'));
 const dialog=w.document.querySelector('dialog');w.OlafProfilePreview.mount(w.document.querySelector('#host'),{kind:'background',image:'/draft.gif'},dialog);
 const frame=w.document.querySelector('iframe');frame.dispatchEvent(new w.Event('load'));
 assert(frame.src.endsWith('profile.html?decorationPreview=1#user'));assert(child.document.body.inert);assert(child.document.querySelector('.member-background').src.endsWith('/draft.gif'));assert(child.document.querySelector('[data-profile-level]').textContent==='42');assert.equal(child.document.querySelector('.member-stats').textContent,'12 games · 500 Points');assert.equal(child.document.querySelector('aside').style.display,'none');assert.equal(child.document.documentElement.dataset.siteTheme,'light');assert.equal(frame.style.visibility,'visible');
 dialog.dispatchEvent(new w.Event('close'));assert.equal(w.document.querySelector('iframe'),null);
});
