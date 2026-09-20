import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../product.js', import.meta.url), 'utf8');
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const context = vm.createContext({});
vm.runInContext([
  between('const STEAM_OFFLINE_GUIDE_URL', 'function rockstarUsageAccordion'),
  between('function productPlatformLinks', 'function productFeatureBlocks'),
  between('function categoryGuideAccordion', 'function mergeRelatedProductSources')
].join('\n'), context);
const url = 'https://olaf-shop.gitbook.io/manual-olaf-shop/undefined/1';

test('email-account guide is replaced once while contact and custom links are preserved', () => {
  const contact = { label: 'ติดต่อร้าน', url: 'https://www.facebook.com/byOlafshop', icon: 'store' };
  const custom = { label: 'Steam', url: 'https://store.steampowered.com', icon: 'external-link' };
  const product = { category: 'steam-account', platformLinks: [contact,
    { label: 'คู่มือ', url: 'https://olaf-shop.gitbook.io/manual-olaf-shop', icon: 'book-open' }, custom] };
  const result = context.productPlatformLinks(product);
  assert.equal(result.length, 3);
  assert.equal(result[0], contact);
  assert.equal(result[1], custom);
  assert.equal(result[2].url, url);
  assert.equal(product.platformLinks[1].url, 'https://olaf-shop.gitbook.io/manual-olaf-shop');
});

test('account products without platform links still receive a guide button and panel', () => {
  assert.equal(context.productPlatformLinks({ category: 'steam-account' })[0].url, url);
  const html = context.categoryGuideAccordion({ category: 'steam-account' });
  assert(html.includes('pd-category-guide-account'));
  assert(html.includes('data-accordion-group="steam-account-guide"'));
  assert(html.includes(`href="${url}"`));
  assert(html.includes('rel="noopener noreferrer"'));
});

test('offline and key guides retain their own original content and destinations', () => {
  const offline = context.categoryGuideAccordion({ category: 'offline' });
  const key = context.categoryGuideAccordion({ category: 'steam-key' });
  assert(offline.includes('STEAM_OFFLINE') === false);
  assert(offline.includes('/undefined/undefined'));
  assert(key.includes('/undefined/key-steam'));
  for (const html of [offline, key]) assert(!html.includes(url));
  assert.equal(context.productPlatformLinks({ category: 'steam-key' })[1].url,
    'https://olaf-shop.gitbook.io/manual-olaf-shop/undefined/key-steam');
});

test('other categories do not receive an email-account guide or changed links', () => {
  for (const category of ['windows', 'minecraft-account', 'minecraft-key', 'rockstar', 'offline']) {
    const links = [{ label: 'คู่มือ', url: 'https://example.com/original', icon: 'book-open' }];
    assert.equal(context.productPlatformLinks({ category, platformLinks: links }), links);
    assert(!context.categoryGuideAccordion({ category }).includes('pd-category-guide-account'));
  }
});
