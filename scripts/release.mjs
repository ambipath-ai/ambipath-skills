import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const write = args.includes('--write');
const consoleIndex = args.indexOf('--console-dir');
const consoleDir = consoleIndex < 0 ? null : resolve(args[consoleIndex + 1]);
const digest = value => createHash('sha256').update(value).digest('hex');
const skillPath = 'skills/ambipath-setup/SKILL.md';
let skill = await readFile(resolve(root, skillPath), 'utf8');
const version = skill.match(/  version: "([^"]+)"/)?.[1];
if (!version) throw new Error('Skill version is missing');
const helperPath = 'skills/ambipath-setup/scripts/merge-directory.mjs';
const helperHash = digest(await readFile(resolve(root, helperPath)));
const pinnedSkill = skill
  .replace(/(  directory-helper-sha256: ")[^"]+("\n)/, `$1${helperHash}$2`)
  .replace(/const expected = '[^']+'; \/\/ Directory helper SHA-256/, `const expected = '${helperHash}'; // Directory helper SHA-256`);
if (!pinnedSkill.includes(`/v${version}/${helperPath}`)) throw new Error('Skill helper URL must use the release tag');
if (write) skill = pinnedSkill;
else if (pinnedSkill !== skill) throw new Error('Skill helper hash differs; run node scripts/release.mjs --write');
const normalized = skill.replace(/(  content-sha256: ")[^"]+("\n)/, '$1$2');
const contentHash = digest(normalized);
const updated = skill.replace(/(  content-sha256: ")[^"]+("\n)/, `$1${contentHash}$2`);
if (write) { skill = updated; await writeFile(resolve(root, skillPath), skill); }
else if (updated !== skill) throw new Error('Skill content hash differs; run node scripts/release.mjs --write');
const files = {};
for (const name of [skillPath, 'skills/ambipath-setup/references/dns.md', 'skills/ambipath-setup/agents/openai.yaml', helperPath]) {
  files[name] = digest(await readFile(resolve(root, name)));
}
const manifest = { version, contentHash, files };
const manifestText = JSON.stringify(manifest, null, 2) + '\n';
if (write) await writeFile(resolve(root, 'release.json'), manifestText);
else if (await readFile(resolve(root, 'release.json'), 'utf8') !== manifestText) throw new Error('Release manifest differs');
if ((await readFile(resolve(root, 'VERSION'), 'utf8')).trim() !== version) throw new Error('VERSION differs');
for (const file of ['.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', 'gemini-extension.json']) {
  const value = JSON.parse(await readFile(resolve(root, file), 'utf8'));
  if ((value.version ?? value.metadata?.version) !== version || value.plugins?.some(plugin => plugin.version !== version)) throw new Error(`${file} version differs`);
}
if (consoleDir) {
  const asset = {
    version, contentHash, sha256: files[skillPath],
    sourceUrl: `https://github.com/ambipath-ai/ambipath-skills/releases/download/v${version}/SKILL.md`,
    rawUrl: `https://raw.githubusercontent.com/ambipath-ai/ambipath-skills/v${version}/${skillPath}`,
    directoryHelper: {
      url: `https://raw.githubusercontent.com/ambipath-ai/ambipath-skills/v${version}/${helperPath}`,
      sha256: helperHash,
    },
    files: { 'SKILL.md': skill, 'scripts/merge-directory.mjs': await readFile(resolve(root, 'skills/ambipath-setup/scripts/merge-directory.mjs'), 'utf8'), 'references/dns.md': await readFile(resolve(root, 'skills/ambipath-setup/references/dns.md'), 'utf8') },
  };
  const path = resolve(consoleDir, 'packages/core/src/generated/ambipath-setup-skill.ts');
  const text = '// Generated from ambipath-skills by scripts/release.mjs. Do not edit.\nexport const setupSkill = ' + JSON.stringify(asset, null, 2) + ' as const;\n';
  if (write) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, text); }
  else if (await readFile(path, 'utf8') !== text) throw new Error('Console skill mirror differs');
}
console.log(JSON.stringify({ version, contentHash, sha256: files[skillPath], verified: !write }));
