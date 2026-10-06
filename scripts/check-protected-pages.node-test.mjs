import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkProtectedPages, contentHash } from './check-protected-pages.mjs';
test('detects changes and missing files; normalizes EOL; supports standalone FE', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'weave-freeze-test-'));
  try {
    const fe = path.join(fixture, 'FE'), be = path.join(fixture, 'BE');
    fs.mkdirSync(path.join(fe, 'docs'), { recursive: true }); fs.mkdirSync(be);
    const client = path.join(fe, 'page.tsx'), server = path.join(be, 'route.js');
    fs.writeFileSync(client, 'original\r\n'); fs.writeFileSync(server, 'server\n');
    fs.writeFileSync(path.join(fe, 'docs/protected-pages.snapshot.json'), JSON.stringify({ files: [
      { repo: 'FE', path: 'page.tsx', sha256: contentHash(client) }, { repo: 'BE', path: 'route.js', sha256: contentHash(server) },
    ] }));
    assert.equal(checkProtectedPages(fe).checked, 2);
    fs.writeFileSync(client, 'original\n');
    assert.deepEqual(checkProtectedPages(fe).errors, []);
    fs.writeFileSync(client, 'changed\n');
    assert.match(checkProtectedPages(fe).errors[0], /Protected file changed: FE\/page.tsx/);
    fs.writeFileSync(client, 'original\n'); fs.unlinkSync(server);
    assert.match(checkProtectedPages(fe).errors[0], /Protected file missing: BE\/route.js/);
    assert.deepEqual(checkProtectedPages(fe, true), { checked: 1, errors: [] });
  } finally {
    assert.equal(path.dirname(path.resolve(fixture)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(fixture).startsWith('weave-freeze-test-'));
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
