# Ambipath setup

Install Ambipath on an existing website with the setup block copied from your signed-in Ambipath console. The reusable skill contains no account details. The block supplies the short-lived, workspace-scoped setup code and exact files.

## Install version 0.1.2

Skills CLI (Claude Code, Codex, Cursor and other supported agents):

```sh
npx skills@1.7.6 add https://github.com/ambipath-ai/ambipath-skills/tree/v0.1.2 --skill ambipath-setup -y
```

To select one agent, add `--agent codex`, `--agent claude-code` or `--agent cursor`. Run this inside the website project. Then paste the setup block from your console and ask the agent to use `ambipath-setup`.

Claude Code plugin:

```sh
claude plugin marketplace add https://github.com/ambipath-ai/ambipath-skills.git#v0.1.2
claude plugin install ambipath@ambipath --scope project
```

Gemini CLI extension:

```sh
gemini extensions install https://github.com/ambipath-ai/ambipath-skills --ref v0.1.2
```

Without Node or a supported installer, read [the same versioned skill](https://github.com/ambipath-ai/ambipath-skills/blob/v0.1.2/skills/ambipath-setup/SKILL.md) and its linked DNS reference in your coding agent. Keep the setup block private.

DNS verification is optional for the on-site assistant. The skill asks for confirmation before any DNS change, and uses existing provider access. It never needs the owner's password or a full-access Ambipath token. Deployments and test conversations follow the owner's current authorization.

## Verify the package

The repository root is both a Claude Code marketplace/plugin and a Gemini extension. `skills/ambipath-setup` is the canonical skill for every installer. No server, MCP credentials or dependency installation is included. The public release tag is `v0.1.2`.


The console download and setup ZIP use the exact `SKILL.md` release asset. Its
front matter includes `metadata.content-sha256`, computed with that field's
quoted value empty; `release.json` also records the complete file SHA-256 and
reference hashes. Never edit a published version or replace its release asset.

After an intentional skill edit, increment the version in all installer
manifests, run `node scripts/release.mjs --write --console-dir ../ambipath-console`,
then run `node scripts/release.mjs --console-dir ../ambipath-console`. The console
CI compares its generated copy with both the immutable tag and the release asset.
Publish the skill release before the console revision that requires it.

The authenticated console ZIP contains `SKILL.md`, `references/dns.md`, and a
private `setup.json` in a folder named with its generation time and code expiry.
The reusable public skill never contains setup codes, proof tokens or owner data.
