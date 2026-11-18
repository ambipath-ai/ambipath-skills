import { readFile, writeFile } from 'node:fs/promises';

// Run against the owner's editable local copy of the effective directory.
const [payloadPath, directoryPath] = process.argv.slice(2);
if (!payloadPath || !directoryPath) throw new Error('Usage: node scripts/merge-directory.mjs <private setup.json> <editable directory.json>');
const setup = JSON.parse(await readFile(payloadPath, 'utf8'));
const generated = setup.discovery.files.find(file => file.path === '/.well-known/ard.json')?.body.entries;
if (!Array.isArray(generated) || !generated.length) throw new Error('Setup contains no ARD entries.');
let original = '';
try { original = await readFile(directoryPath, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const directory = original ? JSON.parse(original) : { entries: [] };
if (!Array.isArray(directory?.entries)) throw new Error('Existing directory must have an entries array.');
let changed = false;
for (const entry of generated) {
  const existing = directory.entries.filter(item => item?.identifier === entry.identifier);
  if (existing.length > 1) throw new Error(`Resolve duplicate directory identifier ${entry.identifier} before merging.`);
  if (!existing.length) { directory.entries.push(entry); changed = true; continue; }
  for (const [key, value] of Object.entries(entry)) {
    if (JSON.stringify(existing[0][key]) !== JSON.stringify(value)) { existing[0][key] = value; changed = true; }
  }
}
if (changed) await writeFile(directoryPath, JSON.stringify(directory, null, 2) + '\n');
