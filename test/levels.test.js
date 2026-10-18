// The street of finished lawns is rebuilt from levelDef(0..lawns), and a
// resumed lawn rebuilds its hills from its seed, so both must be repeatable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelDef } from '../src/levels.js';
import { PICTURES, THEME_PICTURES } from '../src/pictures.js';
import { OWNERS } from '../src/catalog.js';
import { eventTrigger, groundHeight, makeHills, rampHeight, RAMP } from '../src/terrain.js';

const strip = (d) => ({ ...d, theme: d.theme.id });

test('levelDef is the same every time for the same lawn', () => {
  for (let n = 0; n < 60; n++) assert.deepEqual(strip(levelDef(n)), strip(levelDef(n)));
});

test('every third lawn is a giant one', () => {
  for (let n = 0; n < 30; n++) assert.equal(levelDef(n).giant, n % 3 === 2);
});

test('the first lawns are gentle', () => {
  for (const n of [0, 1]) {
    assert.equal(levelDef(n).hills, 0);
    assert.equal(levelDef(n).ramps, 0);
    assert.deepEqual(levelDef(n).powerups, []);
  }
  assert.equal(levelDef(0).event, null);
  assert.ok(levelDef(1).event);
});

test('pictures and owners belong to the lawn\'s world, and change between lawns', () => {
  for (let n = 0; n < 60; n++) {
    const d = levelDef(n);
    assert.ok(PICTURES[d.picture], `lawn ${n} has a real picture`);
    assert.ok(THEME_PICTURES[d.theme.id].includes(d.picture));
    assert.ok(OWNERS[d.theme.id].includes(d.owner));
    if (n % 2 === 1) {
      assert.notEqual(d.picture, levelDef(n - 1).picture, `lawns ${n - 1} and ${n} share a world but not a picture`);
      assert.notEqual(d.owner, levelDef(n - 1).owner);
    }
  }
});

test('lawn sizes stay in a sensible range', () => {
  for (let n = 0; n < 200; n++) {
    const d = levelDef(n);
    assert.ok(d.long >= 10 && d.long <= 30, `lawn ${n} long side ${d.long}`);
    assert.ok(d.short >= 7 && d.short <= d.long, `lawn ${n} short side ${d.short}`);
    // keeps the grass instance count reasonable on an iPad
    assert.ok(d.long * d.short <= 30 * 24);
  }
});

test('hills and the surprise timing come back the same from the seed', () => {
  const a = makeHills(1234, 20, 14, 3);
  const b = makeHills(1234, 20, 14, 3);
  assert.deepEqual(a, b);
  assert.equal(eventTrigger(99), eventTrigger(99));
  const e = eventTrigger(99);
  assert.ok(e >= 0.35 && e <= 0.65);
  // edges of the lawn stay close to flat
  assert.ok(groundHeight(a, [], -5, -5) < 0.05);
});

test('a ramp rises toward its lip and is flat beside it', () => {
  const r = { gx: 10, gy: 5, a: 0 };
  const low = rampHeight(r, 10 - RAMP.len / 2 + 0.1, 5);
  const high = rampHeight(r, 10 + RAMP.len / 2 - 0.1, 5);
  assert.ok(high > low);
  assert.ok(high <= RAMP.h);
  assert.equal(rampHeight(r, 10, 5 + RAMP.wid), 0);
});
