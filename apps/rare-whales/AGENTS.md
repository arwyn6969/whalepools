# Whale Pools product notes

Use **whale** and **whales** throughout product copy, documentation and conversation. The token concept is **Whale Wax / WWAX**. Keep this naming in future additions.

This is a public historical paper-trading demo. WWAX contracts and the paid non-staking claim interface are prepared under RW-006; public/deployment.json is null until a real wallet deployment is verified. Claims, staking, paid equipment, prospective seasons and live execution are not active. Show the actual release state. Keep artwork and simulation work separate from any later financial deployment.

The maintained source is in `public/` and `src/`. Generated `build/` is ignored. New served artwork must be included in both Worker allowlists and have a correct MIME type. Check the actual browser journey and export only the scoped public app.

WWAX economic constants and collection bounds are fixed in contracts/WhaleWaxClaims.sol. Follow CLAIMS.md. Run npm run contracts:test for contract changes, and preserve the exact compiler/dependency locks. Never insert an invented deployment or fee wallet. Operator files are local only and must not enter the public Worker allowlist.
