// scripts/seed-reviews.js
// Inserts the first 3 BOI set reviews into the reviews table.
// Safe to re-run — checks for existing slugs before inserting.
// Usage: node scripts/seed-reviews.js

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envRaw = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envRaw.split('\n')) {
  const eq = line.indexOf('=');
  if (eq === -1 || line.trim().startsWith('#')) continue;
  env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const REVIEWS = [
  {
    set_id: 'bb6df053-c946-48b6-9849-8e39f28096e3', // 42161 Lamborghini Huracán Tecnica
    title: 'LEGO Lamborghini Huracán Tecnica (42161) Review',
    slug: 'lego-42161-lamborghini-huracan-tecnica-review',
    rating: 4,
    verdict: 'Buy it — the best Technic set at this price point, and it still holds up in 2026.',
    youtube_url: null,
    published_at: '2026-05-10T09:00:00Z',
    content: `The LEGO Lamborghini Huracán Tecnica is the kind of set that makes you feel like you're getting away with something. At ₹4,500 (806 pieces), this is Technic at its most accessible — and most honest.

THE BUILD

The build takes about 4 hours at a relaxed pace. It's not a passive experience: the suspension system, the V10 engine with moving pistons, and the working steering all give you something to actually engage your brain. The colour-coded interior structure makes it surprisingly easy to follow even if you've never touched a Technic set before.

The finished model sits low and mean on your desk. The Huracán's silhouette translates well to the Technic form factor — more so than many licensed vehicles at this scale. The doors open. The rear hood lifts to reveal the engine. The steering wheel turns the front wheels. These are small things, but they matter.

INDIA VALUE ANALYSIS

At ₹4,500 MRP, this is positioned well. Toycra and MyBrickHouse both regularly discount it to ₹3,800–4,100. At that price, it's a no-brainer.

Compare it to alternatives at the same price: the smaller Creator 3-in-1 sets at ₹3,999 are fun but are over in 90 minutes. The Huracán will genuinely keep you occupied for an evening, and the end result looks display-worthy.

For a first adult Technic set, this is the one we'd recommend. It's forgiving enough to not be frustrating, complex enough to not be boring.

WHAT COULD BE BETTER

The colour is striking but polarising — Huracán Orange looks amazing in photos and in person. But if you wanted something neutral for a desk at work, you're out of luck. There is no variant.

The rear of the model looks slightly unfinished compared to the front — a common Technic trade-off where the mechanism takes priority over the aesthetic. It's not a dealbreaker, but if you display it, show the front.

THE VERDICT

806 pieces. Working suspension, steering, and V10 with moving pistons. ₹4,500 MRP, often available for less. This is a well-designed, accessible Technic set that earns its price in build satisfaction alone. The Huracán is not a shelf piece for a casual observer — it's for someone who wants to build something and have something to show for it.`,
  },
  {
    set_id: '54442821-f93f-4d5b-a3f1-ac1106039cbf', // 31120 Medieval Castle
    title: 'LEGO Medieval Castle (31120) Review',
    slug: 'lego-31120-medieval-castle-review',
    rating: 5,
    verdict: 'Buy it without hesitation — the best value LEGO set you can buy in India at ₹9,000.',
    youtube_url: null,
    published_at: '2026-05-10T09:30:00Z',
    content: `The LEGO Medieval Castle (31120) is one of those rare sets where the price, the piece count, the build experience, and the end result all line up perfectly. At ₹9,000 for 1,426 pieces across three builds, it's the set we recommend most frequently to adults getting back into LEGO.

THE CONCEPT

Creator 3-in-1 is LEGO's most underrated theme. You get one set that builds into three separate models using the same pieces. The Medieval Castle builds into a castle, a market village, or a tower. Most people build the castle, put it on a shelf, and never try the other two — but even so, the castle alone is worth the price.

THE BUILD

The castle is a 6–8 hour build. It's not a slog — it's genuinely pleasurable. The walls go up in satisfying sections. The gatehouse, the towers, the great hall inside — each section feels like a small completion. There are minifigures: a knight, a wizard, a skeleton, a horse.

The castle design is chunky and characterful rather than finely detailed. The battlements have catapult mechanisms. The walls are hollow — you can open the back to reveal the interior. It looks like a child's drawing of a castle come to life, which is exactly the right aesthetic for this theme.

INDIA VALUE ANALYSIS

₹9,000 for 1,426 pieces is ₹6.31 per piece. For context, premium sets like the Icons range run ₹8–12 per piece. The Castle is exceptional value.

On discount — which happens regularly at Toycra and MyBrickHouse — you'll find it at ₹7,500–8,000. At that price, it's absurd value.

For gifting to someone getting into LEGO as an adult, this is the single best recommendation we can make. It's accessible enough to not intimidate, substantial enough to feel like an achievement.

WHAT COULD BE BETTER

The 3-in-1 nature means some design compromises. The inside of the castle walls is deliberately hollow to allow different configurations, which means the model is not as dense or precise as a dedicated Icons castle would be. If you want maximum detail, 10305 Lion Knights' Castle at ₹38,000 is the answer. This is not that set.

The minifigures are basic. The skeleton is a skeleton. The knight is a knight. No complaints — they fit the set — but don't expect the detail of a licensed theme.

THE VERDICT

1,426 pieces. Three builds. A castle that looks exactly like it should look. ₹9,000 MRP, regularly discounted. This is the set that gets people back into LEGO as adults. It's the set we've recommended the most in the past year. Buy it.`,
  },
  {
    set_id: '773ff85f-e088-4b3a-86f2-a34b99421830', // 10317 Land Rover Defender 90
    title: 'LEGO Land Rover Classic Defender 90 (10317) Review',
    slug: 'lego-10317-land-rover-defender-90-review',
    rating: 4,
    verdict: 'Buy it — the build experience is exceptional, and the end result earns its place on any desk.',
    youtube_url: null,
    published_at: '2026-05-10T10:00:00Z',
    content: `The LEGO Land Rover Classic Defender 90 (10317) is a 2,344-piece Icons set that costs ₹21,600. It is a significant purchase. Here is whether it earns that price.

THE SET

This is a 1:8 scale replica of the classic Series III Land Rover Defender 90, built in a cream-and-dark-green colour scheme that immediately reads as authentic. The vehicle is packed with detail: a working spare wheel on the bonnet, opening doors, a fold-down rear windshield, a removable roof, detailed dashboard, and an inline-4 engine under a lift-able bonnet.

Every surface has been considered. The mudguards, the wing mirrors, the door handles, the jerry can on the back — none of these are stickers. They're built. That's the difference between an Icons set and a Creator set at this price point.

THE BUILD

At 2,344 pieces, this is a substantial build. Budget 10–14 hours. The experience is meditative in the best sense — each section builds in a logical, satisfying sequence. The chassis and suspension come first, then the body panels, then the interior, then the roof. The instructions are clear and well-paced.

The suspension actually works — push down on a corner and it bounces. The steering is linked to a wheel mounted on top of the engine (not the driver's seat wheel, which is decorative). Small details, but they add up.

INDIA VALUE ANALYSIS

₹21,600 is real money. Let's be honest about that. This is a premium discretionary purchase.

At ₹21,600, you're paying ₹9.21 per piece — above average for LEGO, but reasonable for a licensed Icons set with this level of interior detail. The Pickup Truck (10290, 1,678 pieces, ₹11,700) is better value per piece, but this is a more complex and detailed build.

If you can find it discounted — it has appeared at ₹18,500–19,500 at various stores — buy it immediately.

For a gift, this is the Icons set we'd recommend before the Eiffel Tower or the Flower Bouquet (which are display pieces). The Defender is a build experience, not just a display piece.

WHAT COULD BE BETTER

The side mirrors feel slightly fragile. They hold fine in display, but don't expect to handle the model regularly without eventually knocking one loose. A minor annoyance.

The cream colour looks slightly yellow in certain lighting. This is accurate to the reference vehicle but can read as off-white in indoor lighting. Not a flaw — a design choice — but worth knowing before you buy.

THE VERDICT

2,344 pieces. Working suspension, opening bonnet, removable roof, detailed interior. The classic Defender done right. At ₹21,600, it is a premium purchase — but it's a premium product. If you're buying one Icons vehicle set, this is the one.`,
  },
];

async function run() {
  console.log(`Seeding ${REVIEWS.length} reviews...`);

  for (const review of REVIEWS) {
    // Check for existing slug
    const { data: existing } = await sb.from('reviews').select('id').eq('slug', review.slug).single();
    if (existing) {
      console.log(`  SKIP  ${review.slug} (already exists)`);
      continue;
    }

    const { data, error } = await sb.from('reviews').insert(review).select('id, slug').single();
    if (error) {
      console.error(`  ERROR ${review.slug}:`, error.message);
    } else {
      console.log(`  OK    ${data.slug} (${data.id})`);
    }
  }

  const { count } = await sb.from('reviews').select('*', { count: 'exact', head: true });
  console.log(`\nreviews table: ${count} rows`);
}

run().catch(e => { console.error(e); process.exit(1); });
