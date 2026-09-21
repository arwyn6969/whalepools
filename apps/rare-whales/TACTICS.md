# The tactic arcade

`whale-tactics-v1` · exploratory historical sandbox · 21 September 2026.
Specified at 19:29:14 UTC before the first run of the new arms, as RC-005 in the parent project's research change register. Draft season v3 preserves prior v1/v2 configurations. No future evaluation has started.

| ID / name | Entry and exit design |
| --- | --- |
| `trend` / Current Surfer | Original frozen trend-retest rules, unchanged. Green vector breaks prior 10 highs in a 4h uptrend; body-midpoint pullback confirms within 8 chart candles. Stop below setup/retest lows minus 0.2 ATR, at most 4 ATR from signal; target 2.5R. |
| `recovery` / Reef Reclaimer | Original frozen sweep-recovery rules, unchanged. Red climax sweeps prior 20 lows, closes back above the low with at least 35% lower wick; avoid 4h downtrends. Reclaim its high within 5 candles; stop below sweep minus 0.2 ATR, at most 4 ATR; target nearest untouched red-vector midpoint. |
| `breakout` / Cannonball Breakout | New green vector closes above prior 20 highs, in the top quarter of its range, in a 4h uptrend. Stop below the last 2 lows minus 0.2 ATR, at most 3 ATR from signal; target 2R. No pullback wait. |
| `magnet` / Vector Magnet | New green close above prior candle high and EMA50, in mixed/uptrend 4h context. Target nearest untouched red-vector body midpoint above price in prior 100 bars. Source must be in the pattern window; every subsequent high including confirmation must stay below its midpoint. Stop below last 3 lows minus 0.2 ATR, at most 4 ATR from signal. No sweep requirement. |

New arms require at least 200 chart candles of warmup, positive finite ATR, usable closed 4h context, and 20 / 100 continuous chart lookback bars respectively. Context older than the original engine's two-interval threshold is rejected. Confirmation uses no future bars. Signal time is candle close + 1 ms; the earliest modeled fill is the next bar's open. Original modes retain their original continuity rules.

All four use the unchanged spot engine and historical UBTC/USDC 1h/4h fixtures: 24 July 2026 10:00 UTC through 19 September 2026 22:00 UTC, exclusive. This data was previously inspected. The engine applies next-open price/gap checks, minimum 1.5 after-cost reward/risk, cash-limited allocation, 24-hour timeout, daily loss controls and conservative stop-first ambiguity handling. Costs: 0.08% fees plus 0.05% slippage each side. Chart equity includes estimated exit costs. DNA v1 changes risk (0.225–0.275%), allocation (22.5–27.5%) and target distance (±5%). The $1,000 pool budget is split equally across agents. No leverage or shorting.

Each comparison card reruns the same selected NFT with the same share on each tactic, in fixed display order. DNA effect is the percentage-point return difference versus that tactic with neutral stats. Original entry-volume controls remain available only for the two original modes. Neither the new-arm comparison nor DNA effect identifies a causal vector advantage. Trades on the same market are dependent; counts are not independent sample sizes. No winner is selected automatically and parameters were not tuned after seeing these runs.

A future trading passport could retain locked tactic choices, net returns, drawdown, counts and recorder coverage by NFT across prospective seasons. It remains unbuilt. These simulations establish neither repeatable edge nor financial value for a particular NFT. NFT traits are cosmetic; hash-derived DNA is a game rule, not intelligence.

Leverage is a separate proposed perpetual-market experiment requiring a declared venue, funding, margin, liquidation and execution model. Multiplying spot P/L would be misleading. No leverage control, adaptive selection, live order, deposit or fee collection is enabled. Venue references: [Hyperliquid funding](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/funding) and [liquidations](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/liquidations).

Both `/whalepools/` (main) and `/whalepool/` (redirect alias) reach the same demo. WhaleStreet #1 and Rare Whales #245–248 have bundled verified example art; other token IDs use a clear placeholder. Examples do not imply ownership or a collection partnership.
