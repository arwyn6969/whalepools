> **RW-009 current decision · 21 September 2026:** launch the free wallet arcade and defer WWAX. Wax and payment prompts have been removed from the public game. The token remains undeployed, the local launch desk is stopped, and no claim clock has started. The prepared design below is retained for later review; it is not the active launch plan. See [ARCADE.md](ARCADE.md).

# WWAX holder-claim launch

RW-007 review · 21 September 2026. Contracts and launch tools are prepared. **No mainnet deployment has been made by this release.** The public payment interface fails closed until an actual deployment transaction is verified and published in `public/deployment.json`.

## Fixed recipe

| Setting | Value |
| --- | --- |
| Network | Robinhood Chain mainnet, 4663; ETH gas |
| Token | Whale Wax / WWAX, 18 decimals |
| Initial supply | 4,486,800 WWAX, minted entirely to the claim reserve |
| Eligibility | Rare Whales #1–420; WhaleStreet #1–3319 |
| Reward | 100 WWAX per NFT per global 30-day period |
| Duration | Twelve periods, 360 days total; starts 24 hours after deployment |
| Project fee | 0.0001 ETH per NFT per successful claim, separate from network gas |
| Batch | 1–20 NFTs, either or both collections |
| Fee recipient | The deploying wallet, permanently fixed |
| Missed claims | Expire at each period boundary; no backdating or accumulation |
| End of programme | Anyone may burn the distributor’s unused WWAX reserve |

One NFT is sufficient; company membership and promotional seats are separate. Current ownership is checked through ERC-721 `ownerOf` for every claim. NFTs remain with holders; no approval, custody or staking transaction is required. The claim bitmap belongs to each NFT identity, not its wallet, so transfer cannot reset a period. A claim includes the period shown in its review: if a queued transaction mines in another period, it reverts instead of silently using that next period’s allowance. A reverted transaction can still spend gas. A transfer immediately before the next global boundary can still make the new owner eligible in that next period: there is no minimum holding duration.

The bounds are a snapshot of minted identities, not a snapshot of owners. Mint events from both contracts, at Robinhood block **69073297**, enumerate every ID in the ranges above exactly once. The block hash and counts are in `contracts/eligibility.json`; reproduce with `node scripts/check-eligibility.mjs`. Future IDs are excluded. Any burned NFT cannot pass `ownerOf`; a collection-level remint would reuse the same NFT identity and its existing claim history. The claim contract necessarily trusts the original collection contracts’ ownership answers.

There is no owner setter, proxy, pause switch, extra mint function, reward multiplier, transfer tax, team allocation or early reserve withdrawal. These choices also mean a deployed contract cannot be patched or have its fee wallet recovered or changed. Keep control of the deployment wallet. Fee receipts accrue in the distributor until `withdrawFees()` is called; anyone can call it, but ETH can only go to the fixed treasury. A failed withdrawal does not disable holder claims. WWAX can be transferred as a normal ERC-20.

## Run and deploy

```sh
npm ci
npm test
npm run contracts:test
npm run launch:prepare
npm run launch:serve
```

Contract integration tests require Anvil (tested with Foundry v1.3.1). They start a temporary loopback chain and use its unlocked test accounts; no funded keys or mainnet transactions are involved. The optional `npm run contracts:test:fork` reads fresh Robinhood state into a loopback fork with chain ID 31337 and tests claims against the real collection contracts without broadcasting to mainnet. The public RPC does not retain the original snapshot’s account state, so the fork uses and reports a fresh block while retaining the fixed eligibility bounds. Four real-NFT fork claims passed in the RW-007 review. The compiler is pinned to solc 0.8.37, OpenZeppelin 5.6.1, Paris EVM target, optimizer 200 runs. The `tmp` compiler dependency is overridden to patched 0.2.7. `npm audit` reported zero findings when prepared; tests are not an independent security audit.

Open **http://127.0.0.1:48374/** in a browser with your wallet extension. Select Robinhood mainnet, connect the wallet that should receive fees, review the immutable recipe and estimated deployment gas, then confirm the deployment in your wallet. This is a real on-chain transaction and costs gas. It deploys the distributor and token atomically; it sends no ETH principal to either. The local launch desk is never included in the public Worker and has no wallet keys, transaction proxy or writable API.

Use one operator tab. The desk saves an intent record before requesting the wallet transaction, then saves the submitted hash and blocks a second deployment. Wallet speed-ups update the saved hash to the replacement transaction. A confirmed cancellation or revert allows a new attempt; an uncertain submission remains blocked until its wallet history is resolved. The package is reloaded before sending so an old tab cannot deploy a superseded build. Browser storage must work before a request can be sent. If confirmation times out, inspect that hash and reload to resume. Do not clear the record and redeploy merely because the RPC is slow. If the wallet request returned an error with no hash, get the hash from wallet activity and bring it back to this task for verification; do not blindly retry. If the transaction reverted, confirm that on the explorer before preparing another attempt. Only direct deployment from an externally owned wallet is supported by the verifier; factory/Safe deployment is a separate integration.

After confirmation, activate the public configuration using the real hash:

```sh
npm run launch:verify -- 0xYOUR_DEPLOYMENT_TRANSACTION_HASH
npm run build:demo
npm run test:runtime
npm run deploy:check
```

Verification checks the network, successful creation receipt, two confirmations, exact creation-bytecode hash, NFT addresses, treasury and every immutable economic setting. It writes only the verified deployment address and transaction hash. Review and publish that build through the existing Cloudflare deployment and GitHub workflow. Until then, the public page accepts no fee. A local build or a checked box cannot make a deployment live.

`build/launch/standard-input.json` contains complete Solidity sources and settings for explorer verification, with no mock contracts. The compile step checks that this source input reproduces the exact launch bytecode. Submit it to the Robinhood Blockscout verification UI for `WhaleWaxClaims.sol:WhaleWaxClaims`; there are no constructor arguments. The nested token uses `WhaleWaxClaims.sol:WhaleWax` with constructor supply `4486800000000000000000000`. After source verification, the explorer’s write-contract interface can call `withdrawFees()` from a wallet. Check that `treasury()` equals your deployment wallet first.

## Holder journey and release limits

The public Wax Lab shows the recipe while deployment is pending. After activation it verifies the deployment before enabling connection. A holder connects an injected wallet on Robinhood, enters their NFT numbers, checks current ownership and period entitlement at one block, and sees the WWAX amount, project fee and estimated gas. It rechecks account, chain, ownership and period immediately before requesting the claim. The wallet confirms the real transaction; the page links its hash and checks the exact NFT claim events and WWAX transfer before showing success. A successful cancellation transaction is not a successful claim. Reverted transactions take no project fee or reward, but can consume network gas.

Manual token entry supports both collections without requiring an indexer subscription. Automatic wallet NFT discovery, mobile WalletConnect, smart-account deployment, staking, surfboard automation, paid equipment, live trading and persistent company seasons remain unbuilt. Existing simulation rosters and historical results have no WWAX allocation or performance effect. A holder’s real claim is not a live trade.

At 100% participation, project claim fees would total **0.3739 ETH per period / 4.4868 ETH over all twelve periods**, before costs. Actual demand is unknown and may be zero. Token issuance itself is not revenue; no liquidity, redemption value, yield or equipment functionality is promised. The contract tests, repository checks and browser review establish bounded technical behavior; they do not establish financial viability or an independent audit.

Primary references: [Robinhood network settings](https://docs.robinhood.com/chain/add-network-to-wallet/), [ERC-721 ownership](https://eips.ethereum.org/EIPS/eip-721), [OpenZeppelin ERC-20 supply](https://docs.openzeppelin.com/contracts/5.x/erc20-supply), [OpenZeppelin utility contracts](https://docs.openzeppelin.com/contracts/5.x/api/utils).

## RW-007 pre-deployment review

Confirmed fixes: bind a claim to the reviewed period on-chain; verify actual reward events across cancellations and replacements; retain the replacement deployment hash; lock uncertain deployment submissions; reject stale launch packages and unavailable browser storage; count two confirmations consistently. Economic constants, supply, collection bounds, custody and fee recipient rules are unchanged. Forty-three app tests, twenty-two local-chain scenarios and four read-only-fork claims passed in the review. These are internal checks, not an independent audit. Rebuild the launch package before using it; RW-006 bytecode is superseded and was never deployed by this project.
