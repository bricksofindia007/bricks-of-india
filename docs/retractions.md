# BOI Article Retractions

Audit log for retracted articles. Kept until HIGH-10's `retracted_articles` table ships.
Format: newest first.

---

## 2026-06-27 — LEGO Star Wars Ebon Hawk MOC (Cerebras smoke test output)

**Slug:** lego-star-wars-ebon-hawk-moc-revives-nostalgia-price-still-a
**news_articles.id:** 1529176c-243a-4d70-9026-f5fb4cbc30d2
**pending_drafts.id:** 65938a12-b13d-4052-87bc-786df47fb240
**Published:** 2026-06-26 18:07 UTC
**Retracted:** 2026-06-27
**Source:** https://www.brothers-brick.com/2026/02/16/the-knights-of-the-old-republics-ebon-hawk-returns-in-lego/
**Provider:** cerebras (gpt-oss-120b)
**Generator run:** 28256415673 (smoke test — B2 Cerebras failover proof)

**Reason:** Voice quality below BOI standard. Side-effect of Cerebras failover smoke test
(B2 proof run). Content was factually sound and source was authentic (Brothers Brick /
Jonah Frost MOC) but voice failed in three ways:

1. India paragraph degraded to a bullet list (`Estimated import price: around ₹30,000–₹40,000. / Check MyBrickHouse…`) — violates Codex Pattern A/B/C which requires flowing prose with a beat structure.
2. Voice dropped to PR-paraphrase tone after the opening hook ("Brothers Brick reported that…" — generic journalism, no Clarkson inflection from paragraph 2 onward).
3. Wallet-as-character rule broken — wallet present in opener only, absent through the middle four paragraphs.

**Note:** Cerebras failover mechanism itself is proven and working. This retraction is about
the voice quality of one specific output, not the failover system. The article is preserved
here and in `pending_drafts.discard_reason` as a known-weak calibration anchor for the
CRITICAL-4 voice scorer build.

---
