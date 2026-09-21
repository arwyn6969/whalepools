# Current decision · 21 September 2026

RW-006 supersedes the earlier free-testnet recommendation below: the owner requested paid non-staking claims and delegated the settings. The prepared version uses 100 WWAX per eligible NFT per 30-day global period for twelve periods, a 0.0001 ETH project fee per NFT, and a full fixed reserve. The deployment wallet is the permanent fee recipient. Claims remain closed until an actual deployment is verified. See [CLAIMS.md](CLAIMS.md) for exact behavior, fee economics and launch steps. Earlier exploration is retained below for context.

# Whale Wax: design review, 21 September 2026

Status: proposals, not launched features or financial promises. The playable demo has no token, staking, reward balance, deposits, fees, live orders or public registration. This document makes no change to replay rules or the frozen Vector Desk studies.

The recommended order is a fun free demo, a prospective paper season, then a bounded economy if people return to play. Real-money pool vaults are a separate, much larger product. A token cannot manufacture a trading edge or sustainable revenue.

## Dock → collect → equip

An eventual staking contract could accept the two explicitly allowed ERC-721 collections, attribute each deposit to its depositor, and accrue Wax against a published finite season budget. Staking must not give arbitrary transfers or approvals beyond those assets. Use audited components, bounded/batched operations, tests for repeat claims, transfers, emergency withdrawals and accounting precision, followed by independent security review.

Only time actually staked earns rewards. Claim while staked, or settle rewards atomically before unstaking, so an exit does not accidentally confiscate accrued balances. Let users batch claims across their whales. Define a minimum economical claim threshold and show both protocol fee and network gas before signing. Accrual can be continuous with periodic claims; forcing frequent paid clicks is not a useful retention mechanic. Fee rates, token supply, treasury allocation, vesting, distribution and claim cadence remain undecided.

A capped emission schedule gives a budget, not a token value. Newly minted Wax is not revenue. If users claim 1,000 times at a hypothetical $0.10 protocol fee, that produces only $100 gross before operating costs; neither claim activity nor the price is forecast. Income should eventually come from things people voluntarily value: cosmetics, company customisation and useful tools. Avoid selling the expectation of yield or using new token buyers to pay prior holders.

## Equipment

- Surfboard: one per whale, convenience only. Under a holder-claim design it could batch a fixed allowance or offer claim-on-interaction first; under the earlier staking proposal, the whale would already accrue while staked. Automation needs a gas budget, keeper and explicit authorization scheme. An ownership-only claim requiring the owner as sender cannot simply be called by any keeper. No emission multiplier, repeated fee farming or promise of permanently free automation.
- Holy Brick of Kek: HQ trophy and a saved roster preset. Respec only before a future season locks, never undo an actual loss or change an ongoing ranked season.
- Captain’s Drip: crowns, company banners and cosmetic trails. Cosmetic rarity can be expressive without implying higher investment returns.
- Later ideas: a book of collected season stamps, whale biographies based on actual paper trades, optional friendly crew challenges without financial stakes. Reward participation and continuity without escalating emissions, loss of accrued value or punitive daily streaks.

The demo's fit check is only an ephemeral visual preview. It neither writes an equipment ledger nor verifies NFT ownership. Equipment prices and release dates are not decided.

## Mixed collections and ownership

Both Rare Whales and WhaleStreet already count towards the combined 10-NFT route and can share a 12-agent roster. One wallet, one company, one $1,000 simulated starting budget. Promo 1/1 and founder access remain alternative routes, subject to the configured lists. Hash-derived DNA includes collection address, so equal token numbers from different collections are different agents. No collection-specific advantage is promised. Rare Whales #245–248 and WhaleStreet #1 have bundled artwork; other IDs explicitly show missing artwork.

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

## Non-staking claims: later design review, 21 September 2026

Owner asks whether NFT holders could claim WWAX without staking and pay a small ETH fee. **Yes, technically. Recommendation: build a free testnet holder drop and a usable equipment ledger first; defer paid public claims until the reward has a clear use and the contract/distribution rules have been reviewed.** This is a proposal, not a launch authorization, deployed token or quoted fee. It revises the recommended first economy stage; the earlier staking design above remains an optional later route.

A bounded first version could use a fixed-supply ERC-20 and a prefunded distributor with a finite season allocation. Allow only the verified Rare Whales and WhaleStreet collection addresses. The owner signs a claim transaction; the contract verifies `ownerOf(tokenId)` and records `claimed[season][collection][tokenId]` before distribution. Claims send tokens to the owner, require no NFT transfer or NFT operator approval, and cannot be repeated by moving the NFT to another wallet. Allow bounded batches with exact duplicate checks. An advertised equal allowance must be fully reserved for all eligible NFTs; do not silently make it first-come-first-served. New allocations require new published seasons, not an uncapped reward promise.

Ownership at the instant of claiming is not proof of long-term holding. A transferred NFT may already have used that season's allocation; show claim status before purchase and explain that no backdated rewards accrue to its buyer. Borrowing or briefly buying an unclaimed NFT can qualify under an instantaneous ownership rule. If we want to reward a particular holder cohort, specify a snapshot and wallet-bound eligibility instead, with a defined transfer policy. Do not pretend an `ownerOf` check measures time held. A first testnet uses mock counterparts of the two collections; existing mainnet NFTs cannot be verified as if they lived on testnet.

The holder-drop eligibility and existing pool access rule are different decisions: an allowance per NFT need not require the 10-NFT company membership threshold. Promo 1/1/founder company access alone does not create a token allocation. Supply, eligible token IDs, exact allowance, season length, fee and treasury recipient all remain unset.

A payable claim can collect a clearly named **project claim fee**, separately from network gas. ETH is the native currency on Robinhood Chain; users need funds on the selected chain. The UI should show the exact reward, project fee, estimated gas, recipient and remaining entitlement before signing. A paid claim is not a free airdrop. Freeze the fee for each advertised drop, limit batch size, guard against reentrancy and repeat claims, and test allocation exhaustion/failed transfers before a public release. Retain fees in the distributor for a separate authorized treasury withdrawal rather than making every claim depend on an external treasury callback. Administrative powers and any pause/refund policy must be explicit. Staking is not required for this mechanism.

Illustrative arithmetic only: **1,000 successful paid claims × 0.0001 ETH = 0.1 ETH gross project revenue**. This is not a price proposal or demand forecast. Net revenue is lower after actual build, security, support and any sponsored gas costs. User-paid network gas is a separate expense to the user, not project income. More claim buttons or smaller compulsory claim intervals do not create more useful value. A token allocation has no assured resale price, liquidity or cash yield. Sustainable demand should come from equipment/customisation people enjoy using. Paid cosmetics or a useful supporter pack may be a clearer first purchase than repeated fees to collect newly issued tokens.

The surfboard should therefore start as a convenience feature, not a fee-generating harvesting loop: one batch/manual collection flow for the existing allowance, with automation only after its permission and gas-budget model is designed. Holy Brick remains a glowing cosmetic/preset concept; it never improves investment odds.

Current release state: public playable website, browser-local crew choices, inspected historical replays, and visual equipment previews. No WWAX contract/address, minting, claims, balances, equipment ownership, wallet registration, live season leaderboard, staking or live trading has been activated. The on-chain collections exist; this does not make the demo itself an on-chain game.

Technical sources for this review: [ERC-721 ownership interface](https://eips.ethereum.org/EIPS/eip-721), [OpenZeppelin ERC-20/capped-supply components](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20), [Robinhood Chain network settings](https://docs.robinhood.com/chain/add-network-to-wallet/) and [network gas fees](https://ethereum.org/developers/docs/gas/). Architecture and launch sequencing above are design recommendations, not revenue forecasts or completed implementation.
