import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../site-navigation.js', import.meta.url), 'utf8');
const segment = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
function setup(products = []) {
  const panel = { hidden: true, innerHTML: '', setAttribute(name, value) { this[name] = value; } };
  const wrapper = { querySelector: () => panel };
  const context = vm.createContext({
    cleanDisplayText: value => String(value || ''),
    window: { lucide: { createIcons() {} } },
    ensureMobileSearchShell: () => wrapper,
    loadSearchableProducts: async () => products,
    universalSearchRequest: 0, mobileSearchRequest: 0
  });
  vm.runInContext([
    segment('  function escapeHtml', '  function normalizedSearchValue'),
    segment('  function normalizedSearchValue', '  async function loadSearchableProducts'),
    segment('  function findSearchMatches', '  function syncIndexCatalogSearch'),
    segment('  function hideUniversalSearchResults', '  function ensureMobileSearchShell'),
    segment('  async function renderMobileSearchResults', '  function openMobileSearch')
  ].join('\n'), context);
  return { context, panel, wrapper };
}
const fixtures = [
  { id: 'low', name: 'Game Low', sold: 3 },
  { id: 'high', name: 'Game High', sold: 30 },
  { id: 'duplicate', name: 'Game High', sold: 12 },
  { id: 'hidden', name: 'Hidden', sold: 100, isActive: false },
  { id: 'soon', name: 'Upcoming', label: 'เร็ว ๆ นี้' },
  { id: 'pre', name: 'Windows', label: 'PRE-ORDER', stock: 0 },
  { id: 'out', name: 'Sold Out', stock: 0 }
];

test('popular suggestions use real sold counts, deduplicate names and exclude inactive products', () => {
  const { context } = setup();
  assert.deepEqual(Array.from(context.searchDiscoveryProducts(fixtures).popular, p => p.id), ['high', 'low']);
});

test('upcoming needs explicit evidence, not preorder or zero stock', () => {
  const { context } = setup();
  const products = [...fixtures,
    { id: 'future', name: 'Future', releaseDate: '2099-01-01' },
    { id: 'past', name: 'Past', releaseDate: '2020-01-01', label: 'coming soon' }];
  assert.deepEqual(Array.from(context.searchDiscoveryProducts(products).upcoming, p => p.id), ['future', 'soon']);
});

test('discovery escapes product text and explains popularity source and empty data', () => {
  const { context } = setup();
  const html = context.searchDiscoveryHtml([{ id: 'a"?', name: '<script>alert(1)</script>', sold: 4 }]);
  assert(!html.includes('<script>'));
  assert(html.includes('a%22%3F'));
  assert(html.includes('ไม่ใช่สถิติจำนวนค้นหา'));
  assert(html.includes('ยังไม่มีสินค้าที่ประกาศเปิดขายเร็ว ๆ นี้'));
});

test('desktop and mobile empty queries show the same discovery panel', async () => {
  const desktop = setup(fixtures);
  const mobile = setup(fixtures);
  await desktop.context.renderUniversalSearchResults(desktop.wrapper, '');
  await mobile.context.renderMobileSearchResults('');
  assert.equal(desktop.panel.hidden, false);
  assert.equal(desktop.panel.role, 'region');
  assert.equal(desktop.panel.innerHTML, mobile.panel.innerHTML);
});

test('typing still returns matched products instead of discovery suggestions', async () => {
  const app = setup(fixtures);
  await app.context.renderUniversalSearchResults(app.wrapper, 'Game Low');
  assert.equal(app.panel.role, 'listbox');
  assert(app.panel.innerHTML.includes('id=low'));
  assert(!app.panel.innerHTML.includes('ค้นหายอดนิยม'));
});

test('closing desktop search prevents a late discovery response reopening it', async () => {
  const app = setup();
  let resolve;
  app.context.loadSearchableProducts = () => new Promise(done => { resolve = done; });
  const pending = app.context.renderUniversalSearchResults(app.wrapper, '');
  app.context.hideUniversalSearchResults(app.wrapper);
  resolve(fixtures);
  await pending;
  assert.equal(app.panel.hidden, true);
  assert.equal(app.panel.innerHTML, '');
});
