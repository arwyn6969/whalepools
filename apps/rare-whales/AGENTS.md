# Whale Pools product notes

Use **whale** and **whales** throughout product copy, documentation and conversation. The token concept is **Whale Wax / WWAX**. Keep this naming in future additions.

RW-009 launches a free wallet-authenticated historical arcade. The server verifies NFT ownership at submission, calculates the fixed historical score and stores one editable public entry per wallet in the isolated Whale Pools D1 database. The free arcade requires one NFT from either collection. The original founding-season gate remains in season.json for a later prospective season. Do not describe historical arcade ranks as live paper results, real trading, independent experiments or proven skill.

WWAX is deferred at the owner's request. Its prepared contracts and local launch tools remain saved; no token has been deployed and public/deployment.json stays null. The public interface contains no Wax Lab or financial wallet actions. Do not activate claims incidentally while releasing the game.

The maintained source is in `public/` and `src/`. Generated `build/` is ignored. New served artwork must be included in both Worker allowlists and have a correct MIME type. Check the actual browser journey and export only the scoped public app.

WWAX economic constants and collection bounds are fixed in contracts/WhaleWaxClaims.sol. Follow CLAIMS.md. Run npm run contracts:test for contract changes, and preserve the exact compiler/dependency locks. Never insert an invented deployment or fee wallet. Operator files are local only and must not enter the public Worker allowlist.
