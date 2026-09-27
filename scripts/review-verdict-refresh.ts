/**
 * IMPORT ONLY → in-stock verdict refresh for legacy reviews (Wave 1 item 9,
 * 2026-09-26). HELD FOR APPROVAL: the default mode writes nothing to the
 * database.
 *
 * Legacy RADAR reviews that said "IMPORT ONLY" (source_* columns NULL, so the
 * weekly reviews-source-refresh Pass 1 never looked at them) are now sold at
 * MyBrickHouse / Toycra. This regenerates only their verdict section:
 *   - the model makes MINIMAL edits to the review body: every estimated-import
 *     price / "not in Indian stores" / grey-market sentence is rewritten
 *     against the confirmed listed price, and it picks BUY NOW / WAIT / AVOID;
 *     everything else stays verbatim (checked below);
 *   - the legacy "Verdict: IMPORT ONLY…" line is replaced by the retailer
 *     pipeline's deterministic block (price line, Verdict line, disclaimer —
 *     src/lib/publish-draft.ts), so once applied the review is tracked by the
 *     weekly Pass 1 like every retailer-sourced review;
 *   - the title's "Worth ₹<estimate>?" becomes the confirmed price.
 * Listed prices only (locked rule R3): the ABHINAV12 12% is never applied to
 * a price.
 *
 *   npx tsx scripts/review-verdict-refresh.ts --sets 11374,11382,...
 *       -> writes docs/review-verdict-refresh/<date>.{json,md}; no DB writes
 *   npx tsx scripts/review-verdict-refresh.ts --apply docs/review-verdict-refresh/<date>.json --slugs a,b
 *       -> after approval: applies only the named proposals, and only if the
 *          live price/stock still matches what the proposal was written for
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { getSecret } from '../src/lib/get-secret';
import { isPriceFresh } from '../src/lib/price-freshness';
import { resolveDisclaimerVariant, disclaimerTextFor, STORE_DISPLAY_NAME, type SourceRetailer } from '../src/lib/review-disclaimer';
import { unverifiedSetCitations } from '../src/lib/set-identity';
import { MODEL_CONFIG } from '../src/lib/prompts/draft-prompt';

dotenv.config({ path: '.env.local', quiet: true });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getSecret('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const VERDICTS = ['BUY NOW', 'WAIT', 'AVOID'] as const;
type Verdict = typeof VERDICTS[number];
const BANNED = /estimat|import only|grey[- ]market|gray[- ]market|not confirmed india retail|not (?:yet )?(?:available|sold|in) (?:in )?india|not in indian stores|4[–-]6 week|launch(?:es|ing)? later in india/i;
const SIGNOFF = /bombshell|bubyee|see you on the next one|keep building/i;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const fmtInr = (n: number) => {
  const s = String(Math.round(n)); const last3 = s.slice(-3); const rest = s.slice(0, -3);
  return rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
};
const displayDate = (iso: string) => { const d = new Date(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

type Live = { price: number; retailer: SourceRetailer; scrapedAt: string; anchorMrp: number | null; anchorSource: string | null; pieces: number | null };

async function liveListing(setNumber: string): Promise<Live | null> {
  const { data: rows } = await sb.from('store_prices').select('store_id, price_inr, in_stock, scraped_at').eq('set_id', setNumber);
  const fresh = (rows ?? []).filter((r) => r.in_stock && r.price_inr != null && isPriceFresh(r.scraped_at));
  if (!fresh.length) return null;
  const price = Math.min(...fresh.map((r) => Number(r.price_inr)));
  const at = fresh.filter((r) => Number(r.price_inr) === price).map((r) => r.store_id).sort();
  const retailer: SourceRetailer = at.length > 1 ? 'both' : (at[0] as SourceRetailer);
  const scrapedAt = fresh.filter((r) => Number(r.price_inr) === price).map((r) => r.scraped_at).sort().reverse()[0];
  const { data: sum } = await sb.from('set_price_summary').select('anchor_mrp_inr, anchor_source').eq('set_id', setNumber).maybeSingle();
  const { data: setRow } = await sb.from('sets').select('pieces').eq('set_number', setNumber).maybeSingle();
  return { price, retailer, scrapedAt, anchorMrp: sum?.anchor_mrp_inr != null ? Number(sum.anchor_mrp_inr) : null, anchorSource: sum?.anchor_source ?? null, pieces: setRow?.pieces ?? null };
}

function deterministicBlock(verdict: Verdict, live: Live) {
  const variant = resolveDisclaimerVariant(verdict, live.retailer);
  return {
    variant,
    block: [
      `Priced at ₹${fmtInr(live.price)} on ${STORE_DISPLAY_NAME[live.retailer]}, confirmed in stock as of ${displayDate(live.scrapedAt)}.`,
      `Verdict: ${verdict}.`,
      '',
      disclaimerTextFor(variant),
    ].join('\n'),
  };
}

function prompt(review: { title: string; content: string; name: string; setNumber: string }, live: Live, feedback?: string) {
  const mrp = live.anchorMrp ? `The MRP (${live.anchorSource === 'catalogue' ? 'verified LEGO India MRP' : `as listed by ${live.anchorSource}`}) is ₹${fmtInr(live.anchorMrp)}.` : 'No confirmed MRP is available.';
  return `You are editing a PUBLISHED Bricks of India review. When it was written, LEGO ${review.name} (${review.setNumber}) was not sold in India, so it says IMPORT ONLY and uses an estimated import price. It is now confirmed in stock in India:
  Listed price: ₹${fmtInr(live.price)} at ${STORE_DISPLAY_NAME[live.retailer]} (checked ${displayDate(live.scrapedAt)}).
  ${mrp}

Make the MINIMUM edits needed so the review is true today:
- Rewrite every sentence that uses the estimated/import price, says the set is not sold in India, or mentions grey market / importing / waiting for an India launch, so it uses the confirmed listed price ₹${fmtInr(live.price)} and the store name(s) instead.
- Write the replacements in the review's own voice, as if it had been written today with this price. Never write meta-sentences about the update ("It is now confirmed…", "Listed price:", "checked on…", "as listed by…") and never show arithmetic or formulas.
- Replace "Check MyBrickHouse/Toycra for availability" with a plain statement of where it is sold.
- Keep exactly ONE relatable Indian comparison sentence, recomputed for ₹${fmtInr(live.price)} (a number and an Indian reference: Netflix, Spotify, Amul, EMI, biryani…) — remove any other comparison sentence that was based on the old estimate.
- Keep the Toycra note exactly: "Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra." Never apply the 12% to any price and never state a discounted price.
- The only ₹ figures allowed anywhere are ₹${fmtInr(live.price)}, ₹500${live.anchorMrp ? `, ₹${fmtInr(live.anchorMrp)}` : ''}${perPiece(live) ? `, the per-piece price ₹${perPiece(live)} (₹${fmtInr(live.price)} / ${live.pieces} pieces — use exactly this wherever the review states this set's own per-piece price)` : ''}, and small per-piece figures the review uses for OTHER sets or general context (keep those unchanged).
- Every other sentence stays EXACTLY as written — same words, same order, same paragraphs, same sign-off. Do not add headings, markdown or new sections.
- Remove the final "Verdict: IMPORT ONLY…" line entirely (a verdict block is added separately). Do not write any "Verdict:" line.
- Name only the store(s) that actually have it: ${STORE_DISPLAY_NAME[live.retailer]}.${live.retailer !== 'both' ? ` Do not say it is available at ${live.retailer === 'mybrickhouse' ? 'Toycra' : 'MyBrickHouse'}.` : ''}
- The verdict must agree with the review's own conclusion paragraph: if that paragraph advises waiting for a discount, the verdict is WAIT (or edit that one sentence so it agrees).
- Choose the verdict from the review's own assessment of the set plus this price: BUY NOW (fair or good price — especially if clearly below MRP), WAIT (good set, but the price is likely to drop or is high for what it is), AVOID (only if the review itself says it is poor value at any price). IMPORT ONLY is not allowed.
${feedback ? `\nYOUR PREVIOUS ATTEMPT WAS REJECTED: ${feedback}\nFix exactly that.\n` : ''}
Return JSON only: {"verdict": "BUY NOW" | "WAIT" | "AVOID", "body": "<the full revised review body>"}

REVIEW TITLE: ${review.title}
REVIEW BODY:
${review.content}`;
}

async function callModel(text: string): Promise<{ verdict: string; body: string }> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genai = new GoogleGenerativeAI(getSecret('GEMINI_API_KEY')!);
  const res = await genai.getGenerativeModel({ model: MODEL_CONFIG.model }).generateContent({
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 4000, responseMimeType: 'application/json' },
  });
  return JSON.parse(res.response.text());
}

const perPiece = (live: Live) => (live.pieces ? Math.round(live.price / live.pieces) : null);

const paras = (s: string) => s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/** Problems with a model revision, or [] if it is acceptable. */
async function check(original: string, revised: string, verdict: string, live: Live): Promise<string[]> {
  const problems: string[] = [];
  if (!VERDICTS.includes(verdict as Verdict)) problems.push(`verdict "${verdict}" is not BUY NOW / WAIT / AVOID`);
  const banned = revised.match(BANNED); if (banned) problems.push(`still contains "${banned[0]}"`);
  if (/^\s*verdict\s*:/im.test(revised)) problems.push('contains a "Verdict:" line');
  const meta = revised.match(/now confirmed in stock|listed price:|\(checked|as listed by|₹[\d,]+\s*\/\s*[\d,]+\s*pieces|check (?:mybrickhouse|toycra) for availability/i);
  if (meta) problems.push(`meta/prompt wording in the body: "${meta[0]}" -- rewrite in the review's voice`);
  const allowed = new Set([live.price, 500, ...(live.anchorMrp ? [live.anchorMrp] : [])]);
  const pp = perPiece(live);
  if (pp) [pp - 1, pp, pp + 1].forEach((v) => allowed.add(v));
  const figures = [...revised.matchAll(/₹\s?([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, '')));
  // Small (< ₹100) per-piece context figures carried over verbatim from the
  // original ("City sets land around ₹12–₹14 per piece") are fine; any other
  // figure must be one of the confirmed ones.
  const originalSmall = new Set([...original.matchAll(/₹\s?([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, ''))).filter((f) => f < 100));
  const stray = figures.filter((f) => !allowed.has(f) && !(f < 100 && originalSmall.has(f) && (!pp || Math.abs(f - pp) > 1))); if (stray.length) problems.push(`price figures not allowed: ${stray.map((f) => '₹' + fmtInr(f)).join(', ')}`);
  if (pp && /per[‑-]?\s?piece/i.test(original) && !figures.some((f) => Math.abs(f - pp) <= 1)) problems.push(`per-piece price not updated to ₹${pp} (₹${fmtInr(live.price)} / ${live.pieces} pieces)`);
  if (!figures.includes(live.price)) problems.push(`confirmed price ₹${fmtInr(live.price)} missing`);
  if (live.retailer !== 'both') {
    const other = live.retailer === 'mybrickhouse' ? 'Toycra' : 'MyBrickHouse';
    const withoutNote = revised.replace('Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.', '');
    if (new RegExp(other, 'i').test(withoutNote)) problems.push(`mentions ${other}, but only ${STORE_DISPLAY_NAME[live.retailer]} has it in stock`);
  }
  const conclusion = paras(revised).filter((p) => !SIGNOFF.test(p)).slice(-3).join(' ');
  if (verdict === 'BUY NOW' && /wait(?:ing)? for a (?:discount|price drop|sale|deal)|might be wiser to wait|wait this one out/i.test(conclusion)) problems.push('verdict BUY NOW contradicts the conclusion, which advises waiting');
  if (!revised.includes('Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.')) problems.push('Toycra ABHINAV12 note missing or altered');
  if (!SIGNOFF.test(revised.slice(-400))) problems.push('sign-off missing from the end');
  // Minimal-edit check: paragraphs with nothing price/availability-related must survive verbatim.
  const untouchable = paras(original).filter((p) => !/₹|estimat|import|india|stores?|toycra|mybrickhouse|verdict|grey|gray|netflix|spotify|emi|amul|price|cost|expensive|cheap|afford|wallet|splurge|per[‑-]?\s?piece/i.test(p));
  const kept = untouchable.filter((p) => revised.includes(p)).length;
  if (untouchable.length && kept / untouchable.length < 0.8) problems.push(`rewrote too much: only ${kept}/${untouchable.length} unrelated paragraphs kept verbatim`);
  const cites = await unverifiedSetCitations(sb, revised);
  if (cites.length) problems.push(`set citations not matching the set: ${cites.map((c) => c.setNumber).join(', ')}`);
  return problems;
}

function insertBlock(body: string, block: string): string {
  const ps = paras(body);
  const i = ps.findIndex((p) => SIGNOFF.test(p));
  if (i === -1) return `${ps.join('\n\n')}\n\n${block}`;
  return [...ps.slice(0, i), block, ...ps.slice(i)].join('\n\n');
}

function newTitle(title: string, name: string, setNumber: string, price: number): string {
  if (/Worth ₹[\d,]+\?/.test(title)) return title.replace(/Worth ₹[\d,]+\?/, `Worth ₹${fmtInr(price)}?`);
  if (/Worth ₹—\?/.test(title)) return `LEGO ${name} (${setNumber}): Worth ₹${fmtInr(price)}?`;
  return title;
}

async function propose(setNumbers: string[]) {
  const out: any[] = [];
  for (const setNumber of setNumbers) {
    const { data: set } = await sb.from('sets').select('id, name').eq('set_number', setNumber).maybeSingle();
    const { data: reviews } = await sb.from('reviews').select('id, slug, title, content, verdict, rating, source_retailer').eq('set_id', set?.id ?? '');
    const review = (reviews ?? []).find((r) => r.verdict === 'IMPORT ONLY' && !r.source_retailer);
    const others = (reviews ?? []).filter((r) => r !== review);
    if (!set || !review) { out.push({ setNumber, status: 'skipped', reason: 'no legacy IMPORT ONLY review' }); continue; }
    if (others.some((r) => r.source_retailer)) {
      out.push({ setNumber, slug: review.slug, status: 'skipped', reason: `duplicate: ${others.filter((r) => r.source_retailer).map((r) => `${r.slug} (${r.verdict})`).join(', ')} already covers this set from the retailer pipeline -- redirect instead of regenerating` });
      continue;
    }
    const live = await liveListing(setNumber);
    if (!live) { out.push({ setNumber, slug: review.slug, status: 'skipped', reason: 'not in stock at a tracked store with a fresh (<=12h) price' }); continue; }

    let feedback: string | undefined; let attempt: any; let problems: string[] = [];
    for (let i = 0; i < 2; i++) {
      attempt = await callModel(prompt({ title: review.title, content: review.content, name: set.name, setNumber }, live, feedback));
      attempt.verdict = String(attempt.verdict ?? '').toUpperCase().trim();
      problems = await check(review.content, attempt.body ?? '', attempt.verdict, live);
      if (!problems.length) break;
      feedback = problems.join('; ');
      await new Promise((r) => setTimeout(r, 7000)); // Gemini free-tier RPM
    }
    if (problems.length) { out.push({ setNumber, slug: review.slug, status: 'rejected', reason: problems.join('; ') }); continue; }
    const { block, variant } = deterministicBlock(attempt.verdict, live);
    out.push({
      setNumber, slug: review.slug, reviewId: review.id, status: 'proposed',
      live,
      before: { title: review.title, verdict: review.verdict, content: review.content },
      after: {
        title: newTitle(review.title, set.name, setNumber, live.price),
        verdict: attempt.verdict,
        content: insertBlock(attempt.body, block),
        verdict_disclaimer_variant: variant,
        source_retailer: live.retailer,
        source_price_inr: live.price,
        source_stock_status: 'in_stock',
        source_checked_at: live.scrapedAt,
      },
    });
    await new Promise((r) => setTimeout(r, 7000));
  }
  return out;
}

function report(items: any[]): string {
  const lines = [`# IMPORT ONLY verdict refresh — proposals (${new Date().toISOString().slice(0, 16)}Z)`, '', 'Held for approval. Nothing below is live.', ''];
  for (const it of items) {
    lines.push(`## ${it.setNumber} — ${it.slug ?? ''}`, '', `**${it.status.toUpperCase()}**${it.reason ? `: ${it.reason}` : ''}`, '');
    if (it.status !== 'proposed') continue;
    lines.push(`- Live: ₹${fmtInr(it.live.price)} at ${STORE_DISPLAY_NAME[it.live.retailer as SourceRetailer]} (scraped ${it.live.scrapedAt}); MRP ${it.live.anchorMrp ? `₹${fmtInr(it.live.anchorMrp)} (${it.live.anchorSource})` : 'n/a'}`,
      `- Verdict: ${it.before.verdict} → **${it.after.verdict}**`, `- Title: "${it.before.title}" → "${it.after.title}"`, '');
    const b = paras(it.before.content), a = paras(it.after.content);
    const removed = b.filter((p) => !a.includes(p)), added = a.filter((p) => !b.includes(p));
    lines.push('Changed paragraphs — before:', '', ...removed.map((p) => `> ${p.replace(/\n/g, '\n> ')}`), '', 'after:', '', ...added.map((p) => `> ${p.replace(/\n/g, '\n> ')}`), '');
  }
  return lines.join('\n');
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_BLOCK_RE = /Priced at ₹[\d,]+ on [^,]+, confirmed in stock as of [^.]+\.\nVerdict: [^.]+\.\n\nStandard disclaimer:[^\n]+/;

/**
 * Operator rule (2026-09-26): every applied verdict change ends with a dated
 * note, e.g. "Updated 26 Sep 2026: this set is now available in India.
 * Verdict revised from IMPORT ONLY to WAIT."
 */
function updateNote(from: string, to: string, when = new Date()): string {
  return `Updated ${when.getUTCDate()} ${SHORT_MONTHS[when.getUTCMonth()]} ${when.getUTCFullYear()}: this set is now available in India. Verdict revised from ${from} to ${to}.`;
}

async function apply(file: string, slugs: string[], overrides: Record<string, Verdict> = {}) {
  const items = JSON.parse(fs.readFileSync(file, 'utf-8')).filter((i: any) => i.status === 'proposed' && slugs.includes(i.slug));
  for (const it of items) {
    const live = await liveListing(it.setNumber);
    if (!live || live.price !== it.live.price || live.retailer !== it.live.retailer) {
      console.error(`SKIP ${it.slug}: live listing changed since the proposal (${JSON.stringify(live)}) -- re-propose`);
      continue;
    }
    const { data: current } = await sb.from('reviews').select('content, verdict').eq('id', it.reviewId).single();
    if (current?.content !== it.before.content || current?.verdict !== it.before.verdict) {
      console.error(`SKIP ${it.slug}: review changed since the proposal -- re-propose`); continue;
    }
    // Operator verdict override (e.g. BUY NOW -> WAIT when nothing concrete
    // supports BUY NOW at MRP): rebuild the deterministic block to match.
    let verdict: Verdict = it.after.verdict;
    let content: string = it.after.content;
    let variant: string = it.after.verdict_disclaimer_variant;
    if (overrides[it.setNumber] && overrides[it.setNumber] !== verdict) {
      verdict = overrides[it.setNumber];
      const rebuilt = deterministicBlock(verdict, live);
      if (!FULL_BLOCK_RE.test(content)) { console.error(`SKIP ${it.slug}: deterministic block not found for the override`); continue; }
      content = content.replace(FULL_BLOCK_RE, rebuilt.block);
      variant = rebuilt.variant;
    }
    content = `${content.trimEnd()}\n\n${updateNote(it.before.verdict, verdict)}`;
    const { error } = await sb.from('reviews').update({
      title: it.after.title, verdict, content,
      verdict_disclaimer_variant: variant,
      source_retailer: it.after.source_retailer, source_price_inr: it.after.source_price_inr,
      source_stock_status: it.after.source_stock_status, source_checked_at: it.after.source_checked_at,
    }).eq('id', it.reviewId);
    console.log(error ? `FAIL ${it.slug}: ${error.message}` : `APPLIED ${it.slug}: ${it.before.verdict} -> ${verdict}`);
  }
}

(async () => {
  const arg = (k: string) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : undefined; };
  if (arg('--apply')) {
    // --verdict 11512=WAIT,... overrides a proposal's verdict at apply time.
    const overrides = Object.fromEntries((arg('--verdict') ?? '').split(',').filter(Boolean).map((kv) => kv.split('='))) as Record<string, Verdict>;
    for (const v of Object.values(overrides)) if (!VERDICTS.includes(v)) throw new Error(`invalid override verdict: ${v}`);
    return apply(arg('--apply')!, (arg('--slugs') ?? '').split(',').filter(Boolean), overrides);
  }
  const sets = (arg('--sets') ?? '').split(',').filter(Boolean);
  if (!sets.length) throw new Error('usage: --sets 11374,11382,... | --apply <file.json> --slugs a,b');
  const fresh = await propose(sets);
  const dir = path.join('docs', 'review-verdict-refresh');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  // Re-running for some sets replaces only those sets' entries in today's file.
  const file = path.join(dir, `${stamp}.json`);
  const prior = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : [];
  const items = [...prior.filter((p: any) => !sets.includes(p.setNumber)), ...fresh].sort((a: any, b: any) => a.setNumber.localeCompare(b.setNumber));
  fs.writeFileSync(path.join(dir, `${stamp}.json`), JSON.stringify(items, null, 2));
  fs.writeFileSync(path.join(dir, `${stamp}.md`), report(items));
  for (const it of fresh) console.log(`${it.setNumber} ${it.status}${it.reason ? ` -- ${it.reason}` : ''}${it.after ? ` -- ${it.before.verdict} -> ${it.after.verdict}` : ''}`);
})().catch((e) => { console.error(e); process.exit(1); });
