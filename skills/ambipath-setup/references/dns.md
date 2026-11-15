# Optional domain verification

Use exactly the `dns_record` in the owner's current block: `host` is the short label (normally `_ambipath`), `name` is the fully qualified name, and `value` is the TXT value. Do not put the setup code in DNS. Site proof is sufficient to get the on-site assistant live; domain proof enables off-site features.

Look up the authoritative nameservers to identify the DNS host. A registrar name alone does not prove where DNS is managed. Reuse a provider CLI or MCP connection that the owner already authorized. Read the zone and existing TXT records, show the precise additive change, and obtain confirmation immediately before writing DNS. Preserve every unrelated record. A repeated setup should find the same TXT record and make no change.

- Cloudflare, Porkbun, Vercel, Netlify, Route 53: use an existing authenticated provider tool and its current help. Add the supplied TXT value at the exact name. Never replace the entire zone or all TXT values.
- GoDaddy: use its official `gddy` CLI if available. Let the owner complete browser sign-in themselves. Check current CLI help before executing: `gddy dns set` can replace all records matching the name and type. Retain existing values, preview the resulting set, and confirm before writing. Do not attempt registrar login or collect a password.
- Other or unsupported providers: give the owner the DNS host, short host label, full name, TXT type and exact value. Say which name format their provider expects when known; do not guess. Wait for the owner to add it, then trigger the setup verification endpoint.

Report pending propagation as waiting. Do not loop indefinitely or change unrelated DNS to make verification succeed.
