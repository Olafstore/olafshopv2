import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../image-performance.js', import.meta.url), 'utf8');
const originals = [
  'https://i.postimg.cc/RFkN8QQ7/10-h.png',
  'https://i.postimg.cc/sf463nq4/Chat-GPT-Image-18-k-kh-2569-17-43-38.png',
  'https://i.postimg.cc/Df4CXvS5/Chat-GPT-Image-18-k-kh-2569-18-07-36.png'
];
function setup(catalog = true) {
  const events = {};
  const links = [];
  const timers = [];
  const window = { setTimeout: fn => timers.push(fn), location: { href: 'https://olafshop.com/index.html', origin: 'https://olafshop.com' } };
  const document = { body: { matches: () => catalog }, createElement: () => ({}), head: { append: item => links.push(item) },
    addEventListener: (name, fn) => { events[name] = fn; } };
  vm.runInNewContext(source, { window, document, URL });
  return { attrs: window.OlafImages.attrs, events, links, timers };
}

test('all current Windows covers resolve to small local responsive assets', () => {
  const app = setup();
  for (const original of originals) {
    const html = app.attrs(original, 'Windows');
    const local = [...html.matchAll(/assets\/windows\/[\w-]+\.webp/g)].map(m => m[0]);
    assert(local.length >= 3);
    for (const path of local) {
      assert(fs.statSync(new URL(`../${path}`, import.meta.url)).size < 80000);
    }
    assert.match(html, /480w/);
    assert.match(html, /960w/);
    assert(html.includes(original)); // Original retained for upload-failure fallback.
  }
});

test('admin replacement artwork and product detail images are unchanged', () => {
  const custom = 'https://example.com/new-windows.webp';
  assert(setup().attrs(custom).includes(`src="${custom}"`));
  assert(setup(false).attrs(originals[0]).includes(`src="${originals[0]}"`));
});

test('responsive priority image does not preload a redundant large image', () => {
  const app = setup();
  const html = app.attrs(originals[0], 'Windows', { priority: true, sizes: '320px' });
  assert.match(html, /loading="eager"/);
  assert.match(html, /sizes="320px"/);
  assert.equal(app.links.filter(link => link.rel === 'preload').length, 0);
});

test('missing WebP can fall back to original PNG without srcset retry loop', () => {
  const app = setup();
  const removed = [];
  const target = { tagName: 'IMG', dataset: { imageFallbacks: JSON.stringify([originals[0]]) },
    removeAttribute: name => removed.push(name) };
  app.events.error({ target });
  assert.deepEqual(removed, ['srcset', 'sizes']);
  assert.equal(target.src, originals[0]);
});

test('Windows catalog rendering starts before account initialization', () => {
  const code = fs.readFileSync(new URL('../more-products.js', import.meta.url), 'utf8');
  const start = code.indexOf('const productsReady = loadExtraProducts()');
  assert(start > 0);
  assert(start < code.indexOf('await window.OlafStore?.ready'));
  assert.match(code, /window\.OlafImages\.attrs\(cover, product.name/);
});

test('transient image errors retry once then stop at placeholder', () => {
  const app = setup();
  const target = {tagName:'IMG',dataset:{},src:'https://example.com/game.jpg',isConnected:true,naturalWidth:0,
    getAttribute:()=>target.src,removeAttribute:()=>{},classList:{add:()=>{}}};
  app.events.error({target});
  assert.equal(target.dataset.retryPending,'true');
  assert.equal(app.timers.length,1);
  app.timers.shift()();
  app.events.error({target});
  assert.equal(target.dataset.fallbackApplied,'true');
  assert(target.src.startsWith('data:image/svg+xml'));
  app.events.error({target});
  assert.equal(app.timers.length,0);
});
