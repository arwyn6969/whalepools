# Whale Wax: design review, 21 September 2026

Status: proposals, not launched features or financial promises. The playable demo has no token, staking, reward balance, deposits, fees, live orders or public registration. This document makes no change to replay rules or the frozen Vector Desk studies.

The recommended order is a fun free demo, a prospective paper season, then a bounded economy if people return to play. Real-money pool vaults are a separate, much larger product. A token cannot manufacture a trading edge or sustainable revenue.

## Dock → collect → equip

An eventual staking contract could accept the two explicitly allowed ERC-721 collections, attribute each deposit to its depositor, and accrue Wax against a published finite season budget. Staking must not give arbitrary transfers or approvals beyond those assets. Use audited components, bounded/batched operations, tests for repeat claims, transfers, emergency withdrawals and accounting precision, followed by independent security review.

Only time actually staked earns rewards. Claim while staked, or settle rewards atomically before unstaking, so an exit does not accidentally confiscate accrued balances. Let users batch claims across their whales. Define a minimum economical claim threshold and show both protocol fee and network gas before signing. Accrual can be continuous with periodic claims; forcing frequent paid clicks is not a useful retention mechanic. Fee rates, token supply, treasury allocation, vesting, distribution and claim cadence remain undecided.

A capped emission schedule gives a budget, not a token value. Newly minted Wax is not revenue. If users claim 1,000 times at a hypothetical $0.10 protocol fee, that produces only $100 gross before operating costs; neither claim activity nor the price is forecast. Income should eventually come from things people voluntarily value: cosmetics, company customisation and useful tools. Avoid selling the expectation of yield or using new token buyers to pay prior holders.

## Equipment

- Surfboard: one per whale, convenience only. The normal whale already accrues while staked. A board could batch/trigger harvesting subject to a gas budget and keeper availability, or offer claim-on-interaction first. A smart contract does not wake itself. No emission multiplier and no promise of permanently free automation.
- Holy Brick of Kek: HQ trophy and a saved roster preset. Respec only before a future season locks, never undo an actual loss or change an ongoing ranked season.
- Captain’s Drip: crowns, company banners and cosmetic trails. Cosmetic rarity can be expressive without implying higher investment returns.
- Later ideas: a book of collected season stamps, whaley biographies based on actual paper trades, optional friendly crew challenges without financial stakes. Reward participation and continuity without escalating emissions, loss of accrued value or punitive daily streaks.

The demo's fit check is only an ephemeral visual preview. It neither writes an equipment ledger nor verifies NFT ownership. Equipment prices and release dates are not decided.

## Mixed collections and ownership

Both Rare Whales and WhaleStreet already count towards the combined 10-NFT route and can share a 12-agent roster. One wallet, one company, one $1,000 simulated starting budget. Promo 1/1 and founder access remain alternative routes, subject to the configured lists. Hash-derived DNA includes collection address, so equal token numbers from different collections are different agents. No collection-specific advantage is promised. Only four Rare Whales art files are currently available; other IDs explicitly show missing artwork.

Critical integration issue: ERC-721 ownerOf becomes the staking contract after deposit. The existing membership gate would reject the depositor. Add verified staking-beneficiary lookup before true staking, and prevent the same token being assigned twice. Define transfer, withdrawal, season snapshot and equipment-transfer rules. Multiple wallets are not unique humans. Keep initial membership proofs free.

## Rankings and identity

Use prospective paper records for a season with the same start/end, locked rosters, comparable budgets and disclosed costs. Show net return alongside maximum drawdown, completed trades, coverage gaps and time in the season. Separate company and individual agent rankings. Trading agents share a market and often trade the same signals; 12 agents do not supply 12 independent experiments. Historical selection after viewing results is hindsight selection, not evidence of skill.

Resolve an owner's ENS primary name only where supported, with normalization and forward confirmation of the same address, then cache it. Show an address fallback when absent; allow a company nickname without describing it as verified ENS. Obtain explicit public identity consent. Do not guess ENS names from NFT handles. The public demo contains no owners to resolve and no live ranking rows.

## Backing pools

Start with free supporter badges and optional reputation displays, with no redemption or profit entitlement. Taking WWAX or other deposits to trade for users introduces custody, share pricing, realized/unrealized P/L, liquidity, withdrawals, loss allocation and fee accounting. Any performance fee would need an agreed base currency and high-water-mark policy, actual net results, and treatment of deposits/withdrawals. No fee should be charged against imaginary paper profits. Also assess applicable legal requirements before accepting public funds. More trading of our own token is not external revenue; self-trading can destroy value through costs and create misleading volume.

My rough scope estimate, not a quote: off-chain points/visual equipment are a small feature project; limited testnet NFT staking is roughly 1–2 weeks for an experienced team once rules are settled; a mainnet implementation is several further weeks plus independent review, remediation and operational planning. A trading vault is a separate multi-month undertaking and requires evidence that execution works. Hosting the demo cheaply is achievable now; removing launchpad fees does not remove gas, liquidity, contract risk or maintenance.

## References consulted

- [ERC-721 transfer and ownership interface](https://eips.ethereum.org/EIPS/eip-721)
- [Ethereum transaction gas](https://ethereum.org/developers/docs/gas/)
- [OpenZeppelin ERC-4626 accounting and security](https://docs.openzeppelin.com/contracts/5.x/erc4626)
- [ENS normalization and verified primary names](https://ens.domains/blog/post/how-ens-normalization-works)

These sources support technical constraints. Product recommendations and effort estimates above are our design judgment, not source forecasts.
