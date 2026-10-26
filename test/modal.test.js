'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createModalStack } = require('../modal.js');

// Minimal browser-history double: go() is async and fires popstate, like real browsers.
function fakeHistory() {
  const h = { entries: [{ state: null }], i: 0, listeners: [] };
  h.pushState = (state) => { h.entries.splice(h.i + 1); h.entries.push({ state }); h.i++; };
  Object.defineProperty(h, 'state', { get: () => h.entries[h.i].state });
  h.go = (n) => setImmediate(() => { h.i = Math.max(0, Math.min(h.entries.length - 1, h.i + n)); h.listeners.forEach((f) => f()); });
  h.back = () => h.go(-1);
  return h;
}
function setup(answers) {
  const H = fakeHistory(); const asked = [];
  const M = createModalStack({ history: H, confirm: (q) => { asked.push(q); return answers ? answers.shift() : true; } });
  H.listeners.push(() => M.onPopState());
  const mk = (id, dirty) => { const m = { id, shown: false, show() { m.shown = true; }, hide() { m.shown = false; }, isDirty: () => !!dirty.v }; return m; };
  return { H, M, asked, mk };
}

test('open pushes a history entry; UI close pops it again', async () => {
  const { H, M, mk } = setup();
  const ed = mk('editor', { v: false });
  M.open(ed);
  assert.equal(ed.shown, true); assert.equal(H.entries.length, 2); assert.equal(H.state.rbModal, 'editor');
  assert.equal(await M.requestClose('editor'), true);
  assert.equal(ed.shown, false); assert.equal(H.i, 0); assert.equal(M.size, 0);
});

test('browser Back closes the top sheet', async () => {
  const { H, M, mk } = setup();
  const ed = mk('editor', { v: false });
  M.open(ed); H.back(); await new Promise((r) => setImmediate(r));
  assert.equal(ed.shown, false); assert.equal(M.size, 0);
});

test('dirty sheet asks "Discard changes?"; declining keeps it open (button and Back)', async () => {
  const { H, M, asked, mk } = setup([false, false, true]);
  const dirty = { v: true }; const ed = mk('editor', dirty);
  M.open(ed);
  assert.equal(await M.requestClose('editor'), false);
  assert.equal(ed.shown, true); assert.deepEqual(asked, ['Discard changes?']);
  H.back(); await new Promise((r) => setImmediate(r));
  assert.equal(ed.shown, true, 'Back declined keeps sheet'); assert.equal(H.state.rbModal, 'editor', 'history entry restored');
  assert.equal(await M.requestClose('editor'), true);
  assert.equal(ed.shown, false); assert.equal(asked.length, 3);
});

test('force close skips the prompt (used after Save)', async () => {
  const { M, asked, mk } = setup();
  const ed = mk('editor', { v: true }); M.open(ed);
  assert.equal(await M.close('editor'), true); assert.equal(asked.length, 0); assert.equal(ed.shown, false);
});

test('stacked sheets close in order and opening twice is ignored', async () => {
  const { H, M, mk } = setup();
  const a = mk('a', { v: false }), b = mk('b', { v: false });
  M.open(a); assert.equal(M.open(a), false); M.open(b);
  assert.equal(H.entries.length, 3); assert.equal(M.top().id, 'b');
  H.back(); await new Promise((r) => setImmediate(r));
  assert.equal(b.shown, false); assert.equal(a.shown, true);
  await M.requestClose('a'); assert.equal(M.size, 0); assert.equal(H.i, 0);
});
