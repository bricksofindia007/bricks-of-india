# FP5.8 retrofit bar: approved differences and the 12-cycle count

**Rule (decided by Abhinav, P7 item 5, 28 Sep 2026):** the retrofit (the FP5 contract replacing the legacy parser as the writer) may cut over after **12 consecutive scrape cycles** in which the contract-vs-legacy difference on the same feed is **exactly the approved set below and nothing else**. Any new difference, or an approved one going missing, **resets the count to 0**. This file is the approval record. The machine-readable copy is `scripts/lib/fp58-approved-diffs.json`, and every cycle's comparison step (`scripts/scraper-contract-dryrun.mjs`, run by `scrape-prices.yml`) now prints `FP5.8 cycle verdict: COUNTS | RESETS` and writes `fp58.json` into the `match-audit` artifact.

## The 3 approved differences (all "only-legacy": the legacy parser writes a row, the contract refuses it)
| Key | Listing | Why the contract's refusal is safer |
|---|---|---|
| `mybrickhouse:43019:only-legacy` | MyBrickHouse "Soccer Ball" (`lego-r-editions-soccer-ball-sports-gift-43019`), SKU 43019 | The SKU says 43019, but the catalogue names 43019 "Football", so the ladder can't corroborate the name and sends it to the unmatched queue instead of guessing (G6). Here the listing is very likely correct (see "Pending" below), so the cost is one price waiting for a human confirmation. The benefit is that a SKU typo never silently writes a price to the wrong set |
| `toycra:42233:only-legacy` | Toycra "Lego 42233 Technic Mighty Machines (44 pcs)" | The catalogue's 42233 is **"Wrecking Ball Crane"**. A 44-piece "Mighty Machines" item isn't that set. The legacy parser writes this ₹499 price onto 42233, a **wrong price on the Wrecking Ball Crane page**, and the contract refuses it |
| `toycra:71051:only-legacy` | Toycra "Lego 71051 Minifigures Animals Series 28 (Pack Of 12)" | 71051 is a single blind-bag minifigure. This listing is a **12-pack box**, so the legacy parser records the box price as the single figure's price. The contract's CMF-box rule refuses it |

## Count
| Cycle (scrape run) | Differences | Verdict | Count |
|---|---|---|---|
| 27 Sep 20:59 (36350045883) | exactly the 3 | COUNTS | 1 |
| 28 Sep 04:07 (36376384757) | exactly the 3 | COUNTS | 2 |
| 28 Sep 13:07 (36426366268) | the 3 **plus `toycra:43019:only-legacy`** (Toycra started listing "Lego 43019 Editions FIFA Soccer Ball (1498 Pieces)") | **RESETS** | **0** |

## Pending decision (Abhinav): the 43019 synonym
Both 43019 listings are the catalogue's 43019. The catalogue has "Football", theme Editions, **1,498 pieces**, and Toycra's title says "Editions FIFA Soccer Ball (**1498 Pieces**)". Only the name differs: soccer ball vs football. Recommendation:
1. Confirm the 43019 mapping once, as a human-confirmed name alias ("Soccer Ball" ↔ 43019), through the FP5.5 unmatched queue. That's G6: a human confirms, and nothing is guessed.
2. Then both 43019 differences disappear, and the approved set becomes **2: `toycra:42233`, `toycra:71051`**. That is a changed approval record, so it needs Abhinav's sign-off here. The count restarts from the first cycle after the alias lands.

Until then every cycle RESETS, because `toycra:43019` isn't approved. Approving it as a fourth difference instead would record a known-correct price as "safer to refuse", so that isn't recommended.
