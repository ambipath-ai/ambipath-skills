# Ambipath setup

Install Ambipath on an existing website with the setup block copied from your signed-in Ambipath console. The reusable skill contains no account details. The block supplies the short-lived, workspace-scoped setup code and exact files.

## Install version 0.1.1

Skills CLI (Claude Code, Codex, Cursor and other supported agents):

```sh
npx skills@1.7.6 add https://github.com/usefacet/ambipath-skills/tree/v0.1.1 --skill ambipath-setup -y
```

To select one agent, add `--agent codex`, `--agent claude-code` or `--agent cursor`. Run this inside the website project. Then paste the setup block from your console and ask the agent to use `ambipath-setup`.

Claude Code plugin:

```sh
claude plugin marketplace add https://github.com/usefacet/ambipath-skills.git#v0.1.1
claude plugin install ambipath@ambipath --scope project
```

Gemini CLI extension:

```sh
gemini extensions install https://github.com/usefacet/ambipath-skills --ref v0.1.1
```

Without Node or a supported installer, read [the same versioned skill](https://github.com/usefacet/ambipath-skills/blob/v0.1.1/skills/ambipath-setup/SKILL.md) and its linked DNS reference in your coding agent. Keep the setup block private.

DNS verification is optional for the on-site assistant. The skill asks for confirmation before any DNS change, and uses existing provider access. It never needs the owner's password or a full-access Ambipath token. Deployments and test conversations follow the owner's current authorization.

## Verify the package

The repository root is both a Claude Code marketplace/plugin and a Gemini extension. `skills/ambipath-setup` is the canonical skill for every installer. No server, MCP credentials or dependency installation is included. The public release tag is `v0.1.1`.
