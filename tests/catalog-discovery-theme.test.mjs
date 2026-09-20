import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const css = fs.readFileSync(new URL('../catalog-discovery.css', import.meta.url), 'utf8');
const rule = selector => {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `Missing ${selector}`);
  return css.slice(start, css.indexOf('}', start));
};

test('discovery prices reset inherited trailing padding and black stack background', () => {
  const price = rule('#catalog-game-preview .olaf-steam-price');
  for (const declaration of ['padding:0;', 'min-width:0;', 'flex-wrap:nowrap;', 'width:max-content;', 'overflow:hidden;']) {
    assert(price.includes(declaration), declaration);
  }
  const stack = rule('#catalog-game-preview .olaf-steam-price-stack');
  assert(stack.includes('background:transparent;'));
  assert(stack.includes('min-width:0;'));
  assert(stack.includes('flex-direction:column;'));
});

test('genre titles have their own row so long names cannot displace the price', () => {
  const foot = rule('#catalog-game-preview .catalog-genre-game-foot');
  assert(foot.includes('display:grid;'));
  assert(foot.includes('grid-template-columns:minmax(0,1fr);'));
  assert(foot.includes('grid-template-rows:auto auto 1fr;'));
  const title = rule('#catalog-game-preview .catalog-genre-game-foot > strong');
  assert(title.includes('white-space:nowrap;'));
  assert(title.includes('text-overflow:ellipsis;'));
  assert(title.includes('font-size:16px;'));
});

test('original lime price badges use smaller numbers and retain narrow-phone fallback', () => {
  assert(rule('#catalog-game-preview .olaf-steam-price-stack strong').includes('font-size:15px;'));
  const discount = rule('#catalog-game-preview .olaf-steam-discount');
  assert(discount.includes('font-size:14px !important;'));
  assert(discount.includes('background:#a4d037 !important;'));
  assert(rule('#catalog-game-preview .olaf-steam-price').includes('border-radius:0 !important;'));
  assert(css.includes('@media(max-width:360px)'));
  const narrow = css.slice(css.indexOf('@media(max-width:360px)'));
  assert(narrow.includes('grid-template-columns:minmax(0,1fr);'));
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert(index.includes('catalog-discovery.css?v=20260907-profile-polish-v194'));
});

test('phone feature uses landscape cover, four thumbnails and full-width genre cards', () => {
  const mobile = css.slice(css.indexOf('@media(max-width:640px)'), css.indexOf('@media(max-width:360px)'));
  assert(mobile.includes('.olaf-steam-taste-main { grid-row:1; aspect-ratio:16 / 9;'));
  assert(mobile.includes('.olaf-steam-taste-main img { object-fit:cover !important; object-position:center !important;'));
  assert(mobile.includes('.catalog-shot-empty { aspect-ratio:16 / 9;'));
  assert(mobile.includes('.catalog-genre-game img { aspect-ratio:16 / 9; object-fit:cover;'));
  assert(mobile.includes('grid-row:3; grid-template-columns:repeat(4,minmax(0,1fr)) !important;'));
  assert(mobile.includes('.olaf-steam-taste-head { display:contents; }'));
  assert(mobile.includes('.olaf-steam-taste-gallery { display:contents !important; }'));
  assert(mobile.includes('.catalog-genre-grid.is-compact { grid-template-columns:minmax(0,1fr);'));
  assert(mobile.includes('min-height:44px;'));
  assert(mobile.includes('white-space:normal; overflow:visible; overflow-wrap:anywhere; text-overflow:clip;'));
  assert(mobile.includes('min-width:0; height:auto;'));
});

test('gallery constrains intrinsic image sizing and resets legacy mobile column flow', () => {
  const gallery = rule('#catalog-game-preview .olaf-steam-taste-gallery');
  assert(gallery.includes('grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) !important;'));
  assert(gallery.includes('grid-auto-flow:row;'));
  assert(gallery.includes('grid-auto-columns:auto;'));
  const frame = rule('#catalog-game-preview .olaf-steam-taste-shots a');
  assert(frame.includes('position:relative;'));
  assert(frame.includes('width:100%;'));
  assert(frame.includes('max-width:100%;'));
  assert(rule('#catalog-game-preview .olaf-steam-taste-main').includes('align-self:start;'));
  assert(rule('#catalog-game-preview .olaf-steam-taste-shots img').includes('position:absolute;'));
});

test('portrait tablet hero aligns right and featured grid has two or four columns', () => {
  assert(css.includes('@media(min-width:641px) and (max-width:1180px) and (orientation:portrait)'));
  const hero = rule('body.home-page .hero-deal');
  assert(hero.includes('justify-self:end;'));
  assert(hero.includes('margin-left:auto;'));
  assert(css.includes('#featured-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }'));
  assert(css.includes('#featured-grid { grid-template-columns:repeat(4,minmax(0,1fr)); }'));
});
