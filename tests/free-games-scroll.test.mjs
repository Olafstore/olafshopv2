import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../free-games.js', import.meta.url), 'utf8');
function setup({ reduced = false, width = 420 } = {}) {
  const node = () => ({ handlers: {}, addEventListener(name, handler) {
    (this.handlers[name] ??= []).push(handler);
  }});
  const previous = node();
  const next = node();
  const classes = new Set();
  const rail = { clientWidth: width, classList: { toggle(name, on) {
    if (on) classes.add(name); else classes.delete(name);
  } } };
  const track = { ...node(), parentElement: rail, clientWidth: width, scrollWidth: 1300, scrollLeft: 0,
    moves: [], scrollBy(options) { this.moves.push(options); } };
  const observers = [];
  const window = { matchMedia: () => ({ matches: reduced }),
    ResizeObserver: class { constructor(callback) { observers.push(callback); } observe() {} } };
  const document = { addEventListener() {}, getElementById(id) {
    return id === 'free-games-prev' ? previous : id === 'free-games-next' ? next : null;
  } };
  vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, 'window.bindScrollForTest = bindHomeOfferScroll; })();'), { window, document });
  window.bindScrollForTest(track);
  return { window, previous, next, track, classes, observers };
}

test('desktop arrows scroll both directions and disable at each edge', () => {
  const app = setup();
  assert.equal(app.previous.disabled, true);
  assert.equal(app.next.disabled, false);
  app.next.handlers.click[0]();
  assert.equal(app.track.moves[0].left, 357);
  assert.equal(app.track.moves[0].behavior, 'smooth');
  app.track.scrollLeft = 880;
  app.track.handlers.scroll[0]();
  assert.equal(app.previous.disabled, false);
  assert.equal(app.next.disabled, true);
  app.previous.handlers.click[0]();
  assert.equal(app.track.moves[1].left, -357);
});

test('resize hides unnecessary controls and refresh does not duplicate listeners', () => {
  const app = setup();
  app.window.bindScrollForTest(app.track);
  assert.equal(app.next.handlers.click.length, 1);
  assert.equal(app.observers.length, 1);
  app.track.scrollWidth = 400;
  app.observers[0]();
  assert.equal(app.previous.hidden, true);
  assert.equal(app.next.hidden, true);
  assert.equal(app.classes.has('has-overflow'), false);
});

test('keyboard supports reduced motion and does not intercept card link keys', () => {
  const app = setup({ reduced: true });
  let prevented = false;
  app.track.handlers.keydown[0]({ target: app.track, key: 'ArrowRight', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(app.track.moves[0].behavior, 'auto');
  app.track.handlers.keydown[0]({ target: {}, key: 'ArrowRight' });
  assert.equal(app.track.moves.length, 1);
  assert.equal(app.track.handlers.touchmove, undefined);
});

test('stylesheet hides scrollbar while preserving native horizontal scrolling', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /home-free-games-list \{[^}]*overflow-x: auto/);
  assert.match(css, /home-free-games-list \{ scrollbar-width: none;/);
  assert.match(css, /home-free-games-list::-webkit-scrollbar \{ display: none;/);
  assert.match(css, /@media \(min-width: 981px\) \{\s*body\.home-page \.home-free-games-rail/);
});
