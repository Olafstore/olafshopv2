import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const context = { window: {}, document: { addEventListener() {} }, Intl };
vm.runInNewContext(read('free-games.js').replace(/\}\)\(\);\s*$/, 'window.testCards = { shortStartDate, homeUpcomingOfferCard, offerCard }; })();'), context);
const cards = context.window.testCards;

test('date-only mobile ribbon has a short date without invented time or long explanation', () => {
  const offer = { title: '8 More Lives', platform: 'steam', startsAt: '2026-09-10', startDateOnly: true };
  assert.equal(cards.shortStartDate(offer), 'เริ่ม 10 ก.ย.');
  const html = cards.homeUpcomingOfferCard(offer);
  assert(html.includes('home-free-game-date-short">เริ่ม 10 ก.ย.</span>'));
  assert(html.includes('home-free-game-start-detail">เริ่มรับ'));
  assert(html.includes('(ยังไม่ระบุเวลา)'));
});

test('timestamp ribbons and missing dates remain short', () => {
  assert(cards.shortStartDate({ startsAt: '2026-09-10T15:00:00Z' }).length < 20);
  assert.equal(cards.shortStartDate({ startsAt: 'invalid' }), 'เร็ว ๆ นี้');
});

test('source link renders a complete wrapping label instead of a clipped text node', () => {
  const html = cards.offerCard({ title: 'Alone With You', platform: 'epic', platformLabel: 'Epic Games', url: 'https://store.epicgames.com' });
  assert(html.includes('<span>ข่าวจาก Epic Games</span>'));
  const css = read('styles.css');
  assert.match(css, /body\.free-games-page \.free-game-source \{[^}]*flex: 0 1 auto;[^}]*white-space: normal;/);
  assert.match(css, /\.free-games-page \.free-game-card-actions \{[^}]*overflow: visible;/);
});

test('mobile Steam thumbnails fill both grid rows with cover sizing', () => {
  const css = read('styles.css');
  assert.match(css, /body\.home-page \.olaf-steam-item > \.olaf-steam-thumb \{[^}]*grid-row: 1 \/ 3;[^}]*width: 100%; height: 100%;[^}]*object-fit: cover;/);
  assert.match(css, /body\.home-page \.olaf-steam-item \{ grid-template-columns: minmax\(0, 36%\) minmax\(0, 1fr\)/);
  for (const file of ['index.html', 'free-games.html']) {
    assert.match(read(file), /href="styles\.css\?v=[^"]+"/);
    assert(read(file).includes('free-games.js?v=20260905-mobile-card-fit-v169'));
  }
});
