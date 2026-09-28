# FP5.8 retrofit bar: SAFE vs UNSAFE differences and the 12-cycle count

**Rule (Abhinav, P7 item 5, refined in P8 item 3, 28 Sep 2026).** The retrofit (the FP5 contract replacing the legacy parser as the writer) may cut over after **12 consecutive scrape cycles with zero UNSAFE differences** between the contract and the legacy parser on the same feed, **and zero unresolved holds at cutover**. Every cycle's comparison step (`scripts/scraper-contract-dryrun.mjs`, run non-writing by `scrape-prices.yml`) classifies each difference, prints `FP5.8 cycle verdict: COUNTS | RESETS`, and writes `fp58.json` (UNSAFE and SAFE lists) into the `match-audit` artifact.

| Class | What | Effect |
|---|---|---|
| **UNSAFE** | a **different match** (the contract matched a set the legacy parser didn't: `only-contract`); a legacy match the contract dropped **without** queueing it; a **different price** or **different stock** for the same set; a **different badge** (deal tier or best-store list, legacy rows vs contract rows on the same feed) on a set that isn't explained by a SAFE hold | **resets the count to 0** |
| **SAFE** | the contract **holds back** a listing the legacy parser matched and sends it to `unmatched_listings` (the listing is still on the retailer's site; we just don't guess its set) | logged; **doesn't reset**; goes to Abhinav's **weekly alias review** (resolve as an approved alias, a remap, or ignore) |

**At cutover:** zero unresolved holds. Every SAFE hold seen in the counting window must be resolved (alias, remap, or ignored with a reason) before the contract becomes the writer.

## Holds seen so far (each one is SAFE)
| Hold | Listing | Why the contract holds it | Resolution |
|---|---|---|---|
| `mybrickhouse:43019` | "Soccer Ball" (SKU 43019) | SKU 43019, catalogue name "Football" | **Alias "Soccer Ball" → 43019 approved by Abhinav (P8 item 3).** Stored in `public.set_name_aliases`; applied through the db-migrate job (staging first). Once it lands, this hold matches |
| `toycra:43019` (new on 28 Sep 13:07) | "Lego 43019 Editions FIFA Soccer Ball (1498 Pieces)" | same synonym; 1,498 pieces = catalogue | resolved by the same alias |
| `toycra:42233` | "Lego 42233 Technic Mighty Machines (44 pcs)" | the catalogue's 42233 is "Wrecking Ball Crane". The legacy parser writes this ₹499 price onto the wrong set | stays held (correctly). Weekly review: `ignore` with reason "retailer title number is wrong" |
| `toycra:71051` | "Lego 71051 Minifigures Animals Series 28 (Pack Of 12 / 4)" | a multi-pack box. The legacy parser records the box price as the single figure's | stays held (correctly). Weekly review: `ignore` with reason "CMF box" |

## Count
| Cycle (scrape run) | UNSAFE | SAFE holds | Verdict | Count |
|---|---|---|---|---|
| 27 Sep 20:59 (36350045883) | 0 | 3 | COUNTS | 1 |
| 28 Sep 04:07 (36376384757) | 0 | 3 | COUNTS | 2 |
| 28 Sep 13:07 (36426366268) | 0 | 4 (`toycra:43019` added) | COUNTS | 3 |

The first three were re-classified under the P8 rule from their `match-audit` artifacts. Their badge check wasn't computed at the time (it didn't exist yet); from the next cycle on, the step computes everything itself. *(Superseded P7 version: "exactly the 3 approved differences", under which cycle 3 reset.)*
