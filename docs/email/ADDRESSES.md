# Bricks of India — email addresses, routes and DNS

Source: `docs/plans/BOI_Cycle2_Master_Plan.md` §6.3 (FP4, decisions E1–E7). The plan is the design; this file is the operating record of what exists. Update it in the same commit as any address, provider or DNS change.

**Status as of 27 Sep 2026, evening** (P4 addendum 2: temporary legacy aliases, Brevo root auth, Gmail "Send mail as" and filters done by Abhinav; root DMARC and Brevo root records re-checked by public DoH at 19:20 UTC). Earlier status, 27 Sep morning: (setup done by Abhinav on the evening of 27 Sep; DNS re-checked by public DoH lookup on 27 Sep ~07:30 UTC during Stage 0 P0.15. Correction 27 Sep: this file first said "~07:30 UTC", which was IST misread as UTC).

## Principles (plan §6.3)

1. Addresses are identities and routes, not capacity. Capacity comes from providers.
2. Separate reputations by subdomain: `notify.` (price alerts) and `news.` (newsletter) can't damage sign-in deliverability.
3. Two independent providers, both used every day: Resend for customer email, Brevo for internal mail and as the standby.
4. One gateway (FP4.6): every email goes through it (guardrail G12). Not built yet.
5. No `noreply@`. Every user email has Reply-To hello@.

## Addresses

| Address | Role | Incoming mail goes to | Sends through | Status (27 Sep) |
|---|---|---|---|---|
| abhinav@bricksofindia.com | Personal only; to stop being a system sender (FP4.9) | bricksofindia007@gmail.com | — (still used as the `from` of most system email today, see "Current senders" below) | Existing |
| hello@bricksofindia.com | Public contact, Reply-To on every user email, contact form | bricksofindia007@gmail.com (label *BOI/Hello*) | Human replies: Gmail "Send mail as" via Brevo SMTP (E5) | ✅ ImprovMX alias. ✅ "Send mail as" live (27 Sep) |
| privacy@bricksofindia.com | DPDP grievance contact, consent withdrawal, deletion requests, Meta data-deletion contact | bricksofindia007@gmail.com (label *BOI/Privacy*, starred) | Brevo SMTP | ✅ ImprovMX alias. ✅ "Send mail as" live (27 Sep) |
| corrections@bricksofindia.com | Readers report factual errors (corrections page, every review and article) | bricksofindia007@gmail.com (label *BOI/Corrections*) | Brevo SMTP | ✅ ImprovMX alias. ✅ "Send mail as" live (27 Sep) |
| security@bricksofindia.com | Security reports (`/.well-known/security.txt`, FP3.7) | bricksofindia007@gmail.com | — | ✅ ImprovMX alias |
| login@bricksofindia.com | Sender: sign-in links, account notices | alias → hello@ | Resend (root) → failover Brevo (root) | ✅ ImprovMX alias. Brevo root failover pending |
| alerts@notify.bricksofindia.com | Sender: price-alert digests | none (Reply-To hello@) | Resend (`notify.`) → Brevo (`notify.`) per E4 | ✅ Resend domain verified. Brevo `notify.` not set up |
| news@news.bricksofindia.com | Sender: newsletter | none (Reply-To hello@) | Resend Broadcasts (`news.`) | ✅ Resend domain verified |
| system@ops.bricksofindia.com | Sender: every internal and system email | none | Brevo (`ops.`) → failover Resend (root), critical only | ✅ Brevo domain verified |
| ops@bricksofindia.com | Receives all system email (digest, alerts, breaker trips, pipelines) | bricksofindia007@gmail.com (E2) | — | ✅ ImprovMX alias |
| bot@bricksofindia.com | Contact in the scraper user agent and `/bot` page (FP5.10) | → ops@ destination | — | ✅ ImprovMX alias |
| postmaster@bricksofindia.com | Standard address providers expect | → ops@ destination | — | ✅ ImprovMX alias |
| abuse@bricksofindia.com | Standard address providers expect | → ops@ destination | — | ✅ ImprovMX alias |
| alerts@bricksofindia.com | **Legacy root sender** (workflow-freshness-watchdog); moves to system@ops. in FP4.9 (I22, #371) | temporary alias → bricksofindia007@gmail.com, so replies and bounces reach a human | Resend (root), until FP4.9 | ✅ Temporary ImprovMX alias (27 Sep, #371 closed). Remove in FP4.9 |
| notifications@bricksofindia.com | **Legacy root sender** (VID-P4/VID-QP and social notifiers); moves in FP4.9 (I22, #371) | temporary alias → bricksofindia007@gmail.com | Resend (root), until FP4.9 | ✅ Temporary ImprovMX alias (27 Sep, #371 closed). Remove in FP4.9 |
| newsletter@bricksofindia.com | **Legacy root sender** (growth-engine newsletter, paused D22); moves to news@news. in FP4.9 (I22, #371) | temporary alias → bricksofindia007@gmail.com | Resend Broadcasts (root), until FP4.9 | ✅ Temporary ImprovMX alias (27 Sep, #371 closed). Remove in FP4.9 |

ImprovMX (free): 1 domain, 25 aliases, 500 forwards/day, no sending. In use: 13 (abhinav@, the 9 aliases above, and the three temporary legacy-sender aliases alerts@, notifications@, newsletter@ → bricksofindia007@gmail.com, created 27 Sep). They're removed when FP4.9 retires those senders.

## Setup status (27 Sep)

| Piece | Status |
|---|---|
| ImprovMX: 9 new aliases (hello, privacy, corrections, security, login → hello@, ops, bot, postmaster, abuse), all landing in bricksofindia007@gmail.com | ✅ DONE |
| Resend `notify.bricksofindia.com` (alerts@): DKIM present | ✅ VERIFIED |
| Resend `news.bricksofindia.com` (news@): DKIM present | ✅ VERIFIED |
| Brevo `ops.bricksofindia.com` (system@): verification code, DKIM, and its own DMARC `p=none` | ✅ VERIFIED |
| Root `_dmarc.bricksofindia.com` (covers root, notify. and news.) | ✅ PRESENT on 27 Sep: `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` (was NXDOMAIN on 27 Sep) |
| Brevo authentication of the root domain (sign-in failover, human replies as hello@/privacy@) | ✅ DONE: root `brevo-code` TXT and `brevo1._domainkey` CNAME present on 27 Sep |
| Gmail "Send mail as" hello@, privacy@, corrections@ via Brevo SMTP | ✅ DONE (Abhinav, 27 Sep). Test message passed **DKIM, SPF and DMARC** (R33 proven) |
| Gmail filters: *BOI/Hello*, *BOI/Privacy*, *BOI/Corrections*, *BOI/Ops* (ops@, bot@, postmaster@, abuse@), and subject `[CRITICAL]` → marked important | ✅ DONE (Abhinav, 27 Sep) |
| Temporary ImprovMX aliases alerts@, notifications@, newsletter@ → bricksofindia007@gmail.com | ✅ DONE (Abhinav, 27 Sep; I22 #371 closed). Removed when FP4.9 retires those senders |
| **Open:** Brevo SMTP adds an open-tracking pixel to human replies sent as hello@/privacy@/corrections@ | ⏳ Abhinav decides whether to turn it off in Brevo. If it stays on, the FP7.1 privacy policy must disclose it (tracked on FP7.1 #295) |
| Resend pay-as-you-go confirmed OFF | ✅ Confirmed off by Abhinav (Part B7, 27 Sep; R30) |

## DNS records (public lookup, 27 Sep ~07:30 UTC)

| Name | Type | Value (abridged) | Purpose |
|---|---|---|---|
| bricksofindia.com | NS | kira / yadiel.ns.cloudflare.com | Cloudflare is authoritative |
| bricksofindia.com | MX | 10 mx1.improvmx.com, 20 mx2.improvmx.com | Inbound stays on ImprovMX (E7). Cloudflare Email Routing stays disabled |
| bricksofindia.com | TXT | `v=spf1 include:spf.improvmx.com ~all` | Root SPF |
| resend._domainkey.bricksofindia.com | TXT | `p=MIGfMA0…` | Resend DKIM (root) |
| send.bricksofindia.com | MX / TXT | feedback-smtp.ap-northeast-1.amazonses.com / `v=spf1 include:amazonses.com ~all` | Resend return path (root) |
| resend._domainkey.notify.bricksofindia.com | TXT | `p=MIGfMA0…` | Resend DKIM (`notify.`) |
| send.notify.bricksofindia.com | MX / TXT | feedback.forge.rmta.net / `v=spf1 ip4:52.3.252.119 ip4:44.222.39.36 ip4:199.249.231.0/24 ~all` | Resend return path (`notify.`) |
| resend._domainkey.news.bricksofindia.com | TXT | `p=MIGfMA0…` | Resend DKIM (`news.`) |
| send.news.bricksofindia.com | MX / TXT | feedback.forge.rmta.net / same SPF as `send.notify.` | Resend return path (`news.`) |
| ops.bricksofindia.com | TXT | `brevo-code:…` | Brevo domain verification (`ops.`) |
| brevo1/brevo2._domainkey.ops.bricksofindia.com | CNAME | b1/b2.ops-bricksofindia-com.dkim.brevo.com | Brevo DKIM (`ops.`) |
| _dmarc.ops.bricksofindia.com | TXT | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` | DMARC (`ops.`) |
| _dmarc.bricksofindia.com | TXT | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` | Root DMARC (added by Abhinav; seen 27 Sep) |
| bricksofindia.com | TXT | `brevo-code:…` | Brevo domain verification (root) |
| brevo1._domainkey.bricksofindia.com | CNAME | b1.bricksofindia-com.dkim.brevo.com | Brevo DKIM (root) |

### Root DMARC: applied (fallback option below, seen 27 Sep). Kept for the record

Preferred (if Cloudflare DMARC Management is enabled for the zone; it gives the exact `rua` address when turned on):

```
_dmarc.bricksofindia.com  TXT  "v=DMARC1; p=none; rua=mailto:<address shown by Cloudflare DMARC Management>"
```

Fallback (Brevo's aggregate-report address, as already used on `ops.`):

```
_dmarc.bricksofindia.com  TXT  "v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com"
```

The root record also covers `notify.` and `news.` (no subdomain record of their own). `ops.` keeps its own record. Progression (E6): `p=none` → 2 clean weeks of reports → `p=quarantine` (~14 Oct) → runbook `docs/runbooks/` DMARC progression (FP9).

## Streams and budgets (plan §6.3, enforced by the FP4.6 gateway once built)

| Stream | From | Primary → fallback | Daily budget | Unsubscribe |
|---|---|---|---|---|
| AUTH | login@ | Resend → Brevo | 40 reserved | n/a |
| ACCOUNT | login@ | Resend → Brevo | shares AUTH | n/a |
| CONTACT | hello@ | Resend → Brevo | 10 reserved | n/a |
| ALERTS | alerts@notify. | Resend → (E4) Brevo | Resend remainder (≤40) | One-click |
| OPS | system@ops. | Brevo → Resend (critical only) | Brevo ≤50 | n/a |
| NEWS | news@news. | Resend Broadcasts | Marketing quota (1,000 contacts) | One-click |

Resend is capped at 90/day by the gateway (limit 100/day, 3,000/month, 3 domains, 1 webhook endpoint). Brevo free: 300/day.

## Current senders (Stage 0 P0.13 inventory, 27 Sep): all to move onto the gateway (FP4.9)

| Sender (file:line) | Provider | From | To | Est. volume |
|---|---|---|---|---|
| `src/app/actions/contact.ts:44-48` contact form | Resend | abhinav@ | CONTACT_EMAIL (replyTo = visitor) | per submission (~0–2/day) |
| `src/app/actions/newsletter.ts:25-30` confirmation | Resend | abhinav@ | subscriber | per sign-up (~0/day) |
| `src/app/admin/pending/actions.ts:179-182` admin notice | Resend | abhinav@ | abhinav@ | per admin action |
| `scripts/morning-brief.mjs:329-334` (brief.yml, daily) | Resend | abhinav@ | BRIEF_EMAIL | 1/day |
| `scripts/health-check.mjs:58-63` (daily) | Resend | abhinav@ | BRIEF_EMAIL | 1/day (+ alerts) |
| `scripts/content-quality-report.mjs:241-245` (daily) | Resend | abhinav@ | BRIEF_EMAIL | 1/day |
| `scripts/technical-hygiene.mjs:1980-1981` (weekly) | Resend | abhinav@ | BRIEF_EMAIL | ~1/week |
| `scripts/code-audit-notify.mjs:33-36` (weekly) | Resend | abhinav@ | abhinav@ | ~1/week |
| `scripts/scrape-now.mjs:87-90` scraper alert | Resend | abhinav@ | BRIEF_EMAIL | on failure |
| `scripts/workflow-failure-notify.mjs:67-70,118-120` | Resend | abhinav@ | ALERT_EMAIL/BRIEF_EMAIL | on failure |
| `.github/workflows/credit-budget-check.yml:207-212` (daily) | Resend | abhinav@ | BRIEF_EMAIL | on threshold |
| `.github/workflows/monthly-audit-reminder.yml:25-30` | Resend | abhinav@ | BRIEF_EMAIL | 1/month |
| `.github/workflows/workflow-freshness-watchdog.yml:119-124` (daily) | Resend | **alerts@bricksofindia.com** | BRIEF_EMAIL | on stale workflow |
| `scripts/video/notifier.py:29-42` (VID-P4, VID-QP pipelines) | Resend | **notifications@bricksofindia.com** | TO_ADDRESS | ~2–5/day (review, rework, digest, errors) |
| `social-automation/notifier.py:19-32` | Resend | **notifications@bricksofindia.com** | TO_ADDRESS | ~1/day |
| `boi-growth-engine/newsletter/send.py:120-193` (dispatch only) | Resend Broadcasts | **newsletter@bricksofindia.com** | segment + Abhinav copy | per issue (paused, D22) |

No code references `IMPROVMX_*` or `GMAIL_*` secrets. `.env.example:28-31` still lists `GMAIL_USER`/`GMAIL_APP_PASSWORD` placeholders (dead, to remove in FP4.9). Estimated steady volume ≈ 6–12 sends/day, peaking on failure days; the terminal can't read Resend's send log (send-only key), so the 14-day figure needs Abhinav's dashboard.
