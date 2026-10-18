// Offline mode only works if every file the game loads is in sw.js's cache list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const cached = new Set([...sw.matchAll(/^\s*'([^']+)',$/gm)].map((m) => m[1]));

function listFiles(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? listFiles(`${dir}/${d.name}`) : [`${dir}/${d.name}`],
  );
}

test('every game file is cached for offline play', () => {
  const needed = ['index.html', 'manifest.webmanifest', ...listFiles('src'), ...listFiles('vendor'), ...listFiles('icons'), ...listFiles('assets')];
  const missing = needed.filter((f) => !cached.has(f));
  assert.deepEqual(missing, [], `add these to FILES in sw.js (and bump CACHE): ${missing.join(', ')}`);
});

test('every cached file exists', () => {
  const gone = [...cached].filter((f) => f !== './' && !fs.existsSync(path.join(ROOT, f)));
  assert.deepEqual(gone, [], `remove these from FILES in sw.js: ${gone.join(', ')}`);
});
