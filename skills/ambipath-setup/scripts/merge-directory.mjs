import { constants } from 'node:fs';
import { link, lstat, open, readFile, rename, stat, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

// This command reads local data only. Never pass a setup code as an argument.
const [payloadPath, directoryPath, ...extra] = process.argv.slice(2);
if (!payloadPath || !directoryPath || extra.length) throw new Error('Usage: node merge-directory.mjs <private setup.json or pasted-block.txt> <editable directory.json>');
if (resolve(payloadPath) === resolve(directoryPath)) throw new Error('The private setup and public directory must be different files.');
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const parse = (text, label) => {
  try { return JSON.parse(text); } catch { throw new Error(`${label} is not valid JSON; no files were changed.`); }
};
const source = await readFile(payloadPath, 'utf8');
const blocks = [...source.matchAll(/^```ambipath-setup[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm)];
if (blocks.length > 1) throw new Error('Use exactly one private setup block.');
const setup = parse(blocks.length ? blocks[0][1] : source, 'Private setup');
const generated = setup?.discovery?.files?.find(file => file.path === '/.well-known/ard.json')?.body?.entries;
if (!Array.isArray(generated) || !generated.length) throw new Error('Setup contains no ARD entries.');
const validIdentity = entry => record(entry) && typeof entry.identifier === 'string' && entry.identifier.startsWith('urn:air:') &&
  typeof entry.type === 'string' && typeof entry.url === 'string' && /^https:\/\//.test(entry.url);
if (!generated.every(validIdentity) || new Set(generated.map(entry => entry.identifier)).size !== generated.length) {
  throw new Error('Setup contains invalid or duplicate ARD identities.');
}
const migrations = setup.discovery.directoryMerge?.migrations ?? [];
if (!Array.isArray(migrations) || !migrations.every(item => record(item) &&
  typeof item.fromIdentifier === 'string' && item.fromIdentifier.startsWith('urn:air:') &&
  item.fromIdentifier !== item.toIdentifier && generated.some(entry => entry.identifier === item.toIdentifier) &&
  Array.isArray(item.expected) && item.expected.length && item.expected.every(match =>
    record(match) && typeof match.type === 'string' && typeof match.url === 'string' && /^https:\/\//.test(match.url))) ||
  new Set(migrations.map(item => item.fromIdentifier)).size !== migrations.length) {
  throw new Error('Setup contains invalid or ambiguous ARD migrations.');
}

// Refuse symlinks and preserve the old file until every identity is validated.
let original = '', originalStat;
try {
  originalStat = await lstat(directoryPath);
  if (!originalStat.isFile() || originalStat.isSymbolicLink()) throw new Error('The directory must be an editable regular file, not a symlink.');
  const payloadStat = await stat(payloadPath);
  if (originalStat.dev === payloadStat.dev && originalStat.ino === payloadStat.ino) throw new Error('The private setup and public directory must be different files.');
  const handle = await open(directoryPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { original = await handle.readFile('utf8'); } finally { await handle.close(); }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const directory = originalStat ? parse(original, 'Existing directory') : { entries: [] };
if (!record(directory) || !Array.isArray(directory.entries)) throw new Error('Existing directory must have an entries array.');
let changed = false;
for (const entry of generated) {
  const existing = directory.entries.map((item, index) => ({ item, index })).filter(({ item }) => item?.identifier === entry.identifier);
  if (existing.length > 1) throw new Error('Resolve duplicate directory identifiers before merging; no files were changed.');
  const legacy = migrations.filter(item => item.toIdentifier === entry.identifier).flatMap(migration =>
    directory.entries.map((item, index) => ({ item, index, migration })).filter(({ item }) => item?.identifier === migration.fromIdentifier));
  if (legacy.length > 1 || (legacy.length && existing.length)) throw new Error('Both legacy and current identities, or multiple legacy identities, are present. Resolve the collision before merging; no files were changed.');
  if (legacy.length && !legacy[0].migration.expected.some(match => match.type === legacy[0].item.type && match.url === legacy[0].item.url)) {
    throw new Error('A legacy identifier points to an unrecognized service. Review it before migrating; no files were changed.');
  }
  if (existing.length && (existing[0].item.type !== entry.type || existing[0].item.url !== entry.url)) {
    throw new Error('A current identifier points to a different service. Review it before merging; no files were changed.');
  }
  const match = existing[0] ?? legacy[0];
  if (!match) { directory.entries.push(entry); changed = true; continue; }
  // Spread keeps unknown fields without invoking setters such as __proto__.
  const merged = { ...match.item, ...entry };
  if (JSON.stringify(merged) !== JSON.stringify(match.item)) {
    directory.entries[match.index] = merged;
    changed = true;
  }
}
if (changed) {
  const temporary = join(dirname(directoryPath), `.${basename(directoryPath)}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, originalStat ? originalStat.mode & 0o777 : 0o644);
    await handle.writeFile(JSON.stringify(directory, null, 2) + '\n', 'utf8');
    if (originalStat) await handle.chmod(originalStat.mode & 0o777);
    await handle.sync();
    await handle.close(); handle = undefined;
    // Reject intervening edits and replacement links before publishing the result.
    let currentStat;
    try { currentStat = await lstat(directoryPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (originalStat ? !currentStat?.isFile() || currentStat.dev !== originalStat.dev || currentStat.ino !== originalStat.ino ||
      await readFile(directoryPath, 'utf8') !== original : currentStat) {
      throw new Error('The directory changed while merging. Retry after reviewing it; no files were changed.');
    }
    if (originalStat) await rename(temporary, directoryPath);
    // An atomic, exclusive link cannot replace a file created after our read.
    else await link(temporary, directoryPath);
  } finally {
    if (handle) await handle.close();
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
console.log(changed ? 'ARD directory merged.' : 'ARD directory already current; no changes.');
