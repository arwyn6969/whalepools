# Whale Pools current development status

Updated 2 October 2026. The deployed product is the free historical arcade described in ARCADE.md. WWAX remains deferred and undeployed. The founding paper season remains draft and requires its own recorder and execution system.

## Current maintenance candidate

Branch: codex/maintain-arcade-toolchain, based on 46945f8a73469299e1bf70e67dd7218025b9aca2.

Wrangler is updated from 4.136.1 to 4.144.0, Miniflare from 5.20260921.0-alpha to 5.20260926.1-alpha, and Undici from 7.29.0 to 7.29.1. The dependency audit reports zero advisories. The application esbuild, viem, Solidity compiler and OpenZeppelin lock entries are unchanged. No arcade source, rules, data, database migrations, financial configuration or compatibility date changes are included.

All 66 tests, the demo build, the actual Cloudflare runtime test and deployment dry run pass. Generated frontend assets remain reproducible against the previous release. This is a local maintenance candidate until its repository/release receipt records otherwise.

## Next product work

1. Preserve unpublished drafts per wallet and rules version.
2. Recover inventory reads and bound API waits while retaining exact-block ownership checks.
3. Separate spectator replay state from private drafts and simplify the builder.
4. Add a shareable company destination and a separately versioned challenge.
5. Measure activation and run a small observed holder pilot.

The project planning workspace at Rare WHALES contains the current backlog, source manifest and collector-site work. ECONOMY.md retains earlier paid/token proposals as historical material; its RW-009 deferral is the current decision. Real holder desktop/mobile acceptance is still required.
