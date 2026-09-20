import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const css = read('styles.css');

test('mobile logo image is visible and decorative gamepad is suppressed only when an image exists', () => {
  assert.match(css, /\.topbar\.site-topbar-unified \.brand-mark > img\s*\{\s*display: block !important/);
  assert.doesNotMatch(css, /\.topbar\.site-topbar-unified \.brand-mark > img\s*\{\s*display: none/);
  assert.match(css, /brand-mark:has\(> img\)::before,[\s\S]*?content: none !important/);
  // The existing common loader still supplies the same logo on all viewports.
  assert.match(read('site-navigation.js'), /applyAdminBrandLogo\(settings\?\.siteIconUrl\)/);
});

test('phone notification button and badge container remain visible and interactive', () => {
  const section = css.slice(css.indexOf('/* Phone topbar:'), css.indexOf('/* v72:'));
  const hiddenRule = section.slice(0, section.indexOf('display: none !important'));
  assert(!hiddenRule.includes('notification-wrap'));
  assert(!hiddenRule.includes('open-notifications'));
  assert.match(section, /\.notification-wrap\s*\{[^}]*display: inline-flex !important/);
  assert.match(section, /#open-notifications\s*\{[^}]*pointer-events: auto !important/);
  assert.match(section, /\.notification-wrap\s*\{[^}]*overflow: visible !important/);
  assert.match(section, /@media \(max-width: 360px\)/);
});

test('all storefront headers load the repaired CSS and retain their notification panels', () => {
  for (const file of ['index.html', 'product.html', 'more-products.html', 'free-games.html', 'free-random.html', 'point-topup.html', 'profile.html']) {
    const html = read(file);
    assert.match(html, /styles\.css\?v=20260905-search-discovery-v170/, file);
    assert.equal((html.match(/id="open-notifications"/g) || []).length, 1, file);
    assert.equal((html.match(/id="notification-popover"/g) || []).length, 1, file);
  }
});

test('shared mobile notification toggle remains wired to its existing panel', () => {
  const source = read('site-navigation.js');
  assert(source.includes('["#open-notifications", "notifications", "#notification-popover"]'));
  assert(source.includes('toggleTopbarPopover(key, popoverSelector, button)'));
});
