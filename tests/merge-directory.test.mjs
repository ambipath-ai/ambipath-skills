import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, symlink, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const helper = fileURLToPath(new URL('../skills/ambipath-setup/scripts/merge-directory.mjs', import.meta.url));
const entry = { identifier: 'urn:air:site.example:agent:deployment', type: 'application/poppy+json', url: 'https://site.example/.well-known/poppy.json', displayName: 'Studio', representativeQueries: ['How can you help?'] };
const legacyId = 'urn:air:site.example:agent:tenant';
const legacy = { ...entry, identifier: legacyId, type: 'application/json', url: 'https://old.agents.example/.well-known/poppy.json' };
const thirdParty = { identifier: 'urn:air:site.example:search', url: 'https://search.example', type: 'application/json', rules: { preserve: true } };
const payload = { discovery: { files: [{ path: '/.well-known/ard.json', body: { entries: [entry] } }], directoryMerge: { migrations: [{ fromIdentifier: legacyId, toIdentifier: entry.identifier, expected: [{ type: legacy.type, url: legacy.url }] }] } } };
async function fixture(t, directory, source = JSON.stringify(payload)) {
  const root = await mkdtemp(join(tmpdir(), 'ambipath-merge-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const input = join(root, 'setup.txt'), output = join(root, 'ard.json');
  await writeFile(input, source, { mode: 0o600 });
  if (directory !== undefined) await writeFile(output, typeof directory === 'string' ? directory : JSON.stringify(directory), { mode: 0o600 });
  return { input, output, run: () => spawnSync(process.execPath, [helper, input, output], { encoding: 'utf8', cwd: root }) };
}
test('migrates recognized legacy identity in place, preserves data and repeats without writing', async t => {
  const f = await fixture(t, { rules: { keep: true }, entries: [thirdParty, { ...legacy, custom: { keep: ['yes'] } }, { third: true }] });
  const privateBefore = await readFile(f.input, 'utf8');
  assert.equal(f.run().status, 0);
  const first = await readFile(f.output, 'utf8'), metadata = await stat(f.output);
  assert.deepEqual(JSON.parse(first), { rules: { keep: true }, entries: [thirdParty, { ...entry, custom: { keep: ['yes'] } }, { third: true }] });
  assert.equal(metadata.mode & 0o777, 0o600);
  assert.match(f.run().stdout, /already current/);
  assert.equal(await readFile(f.output, 'utf8'), first);
  assert.equal((await stat(f.output)).mtimeMs, metadata.mtimeMs);
  assert.equal(await readFile(f.input, 'utf8'), privateBefore);
});
test('accepts a whole copied prompt with one private fenced block from an ordinary directory', async t => {
  const f = await fixture(t, undefined, `Set up this website.\n\n\`\`\`ambipath-setup\n${JSON.stringify(payload)}\n\`\`\`\nKeep it private.\n`);
  assert.equal(f.run().status, 0);
  assert.deepEqual(JSON.parse(await readFile(f.output, 'utf8')), { entries: [entry] });
});
test('appends new entries after unrelated entries and keeps unknown fields on current entries', async t => {
  const f = await fixture(t, { entries: [thirdParty, { ...entry, custom: true, displayName: 'Old name' }], policy: 'keep' });
  assert.equal(f.run().status, 0);
  assert.deepEqual(JSON.parse(await readFile(f.output, 'utf8')), { entries: [thirdParty, { ...entry, custom: true }], policy: 'keep' });
});
for (const [name, entries] of [
  ['duplicate current IDs', [entry, entry]],
  ['duplicate legacy IDs', [legacy, legacy]],
  ['old and new collision', [legacy, entry]],
  ['legacy identity with foreign URL', [{ ...legacy, url: 'https://unrelated.example/poppy.json' }]],
  ['legacy identity with wrong type', [{ ...legacy, type: 'text/markdown' }]],
  ['current identity with foreign URL', [{ ...entry, url: 'https://unrelated.example/poppy.json' }]],
]) test(`rejects ${name} before any write`, async t => {
  const f = await fixture(t, { entries: [thirdParty, ...entries] });
  const before = await readFile(f.output, 'utf8');
  assert.notEqual(f.run().status, 0);
  assert.equal(await readFile(f.output, 'utf8'), before);
});
for (const text of ['', '[]', '{"entries":{}}', '{"entries":[']) test(`rejects malformed directory ${JSON.stringify(text)}`, async t => {
  const f = await fixture(t, text);
  assert.notEqual(f.run().status, 0);
  assert.equal(await readFile(f.output, 'utf8'), text);
});
test('refuses symlink and private-input output paths', async t => {
  const f = await fixture(t, undefined);
  await symlink(f.input, f.output);
  const before = await readFile(f.input, 'utf8');
  assert.notEqual(f.run().status, 0);
  assert.equal(await readFile(f.input, 'utf8'), before);
  assert.notEqual(spawnSync(process.execPath, [helper, f.input, f.input]).status, 0);
});
test('a later invalid entry cannot partially write an earlier update', async t => {
  const second = { ...entry, identifier: `${entry.identifier}:mcp`, type: 'application/mcp-server-card+json', url: 'https://service.example/mcp/server-card' };
  const setup = structuredClone(payload);
  setup.discovery.files[0].body.entries.push(second);
  const f = await fixture(t, { entries: [legacy, { ...second, url: 'https://foreign.example' }] }, JSON.stringify(setup));
  const before = await readFile(f.output, 'utf8');
  assert.notEqual(f.run().status, 0);
  assert.equal(await readFile(f.output, 'utf8'), before);
});
