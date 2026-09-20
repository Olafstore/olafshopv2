import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
for (const page of ['login', 'register']) {
  test(`${page} keeps functional form hooks and valid inline scripts`, () => {
    const html = read(`${page}.html`);
    assert(html.includes('auth-design.css?v=20260907-auth-icons-v202'));
    assert(html.includes(`id="${page}-form"`));
    for (const id of ['email','password','submit-btn','toggle-pw',`google-${page}-btn`]) assert(html.includes(`id="${id}"`));
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length);
    assert(html.includes(`href="${page}.html" aria-current="page"`));
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
  });
}
test('shared design contains logo sizing, phone layout and accessibility safeguards', () => {
  const css = read('auth-design.css');
  for (const token of ['object-fit: contain','overflow-y: auto','font-size: 16px','prefers-reduced-motion','focus-visible','max-width: 820px']) assert(css.includes(token));
  assert(css.includes('.auth-redesign .auth-showcase { display: flex;'));
  assert(css.includes('grid-template-columns: 46px minmax(0,1fr)'));
  assert(css.includes('h2 { grid-column: 2; grid-row: 1;'));
});
