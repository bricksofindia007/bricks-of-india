'use client';

import { useState } from 'react';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Option   { label: string; sub: string; value: string; }
interface Question { id: string; q: string; sub: string; options: Option[]; }
interface Outcome  { theme: string; emoji: string; tagline: string; desc: string; set: string; setNum: string; why: string; accent: string; }
type Answers = Record<string, string>;

// ── Questions ──────────────────────────────────────────────────────────────────
const QUESTIONS: Question[] = [
  {
    id: 'budget', q: 'Your LEGO budget is…', sub: 'Be honest. Your wallet already knows.',
    options: [
      { label: 'Under ₹2,000',    sub: 'Student energy. Respect.',                  value: 'low'   },
      { label: '₹2,000 to ₹5,000', sub: 'The sweet spot.',                          value: 'mid'   },
      { label: '₹5,000 to ₹15,000', sub: 'Now we are talking.',                     value: 'high'  },
      { label: '₹15,000 plus',    sub: 'Either rich or lying to yourself.',           value: 'ultra' },
    ],
  },
  {
    id: 'goal', q: 'When you finish a build, you want to…', sub: 'No wrong answers. Mostly.',
    options: [
      { label: 'Display it and never touch it again', sub: 'A museum, but make it plastic.',    value: 'display' },
      { label: 'Pull it apart and rebuild',           sub: 'The restless creative.',            value: 'rebuild' },
      { label: 'Actually play with it',               sub: 'No judgment. Genuinely.',           value: 'play'    },
      { label: 'Photograph it and post online',       sub: 'Content first. Always.',            value: 'photo'   },
    ],
  },
  {
    id: 'saturday', q: 'Your ideal Saturday is…', sub: 'This is personality profiling. Act accordingly.',
    options: [
      { label: 'Coffee + a complex problem to solve',       sub: 'The engineer has logged on.',        value: 'solver'    },
      { label: 'A nostalgia trip from childhood',           sub: 'The inner child is running the show.', value: 'nostalgic' },
      { label: 'Something the kids will love too',          sub: 'Responsible adult. Allegedly.',       value: 'family'    },
      { label: 'Something that looks expensive on a shelf', sub: 'Aesthetic is a personality.',         value: 'aesthetic' },
    ],
  },
  {
    id: 'markup', q: 'India import markup means LEGO costs 35–40% more. You…', sub: 'Your response here is deeply revealing.',
    options: [
      { label: 'Wait for a sale. I am patient.',      sub: 'Discipline is a superpower.',      value: 'patient'   },
      { label: 'Worth it. I want it now.',            sub: 'Instant gratification nation.',    value: 'impulsive' },
      { label: 'Order from abroad via a friend',      sub: 'The logistics mastermind.',        value: 'importer'  },
      { label: 'What is import markup',               sub: 'Genuinely asking.',                value: 'unaware'   },
    ],
  },
  {
    id: 'bigset', q: 'You see a ₹24,999 LEGO set. You…', sub: 'The most important question on this quiz.',
    options: [
      { label: 'Calculate the EMI immediately',              sub: '3 months no-cost. Justified.',     value: 'emi'     },
      { label: 'Walk away, come back 3 times, then buy it', sub: 'The classic ritual.',               value: 'ritual'  },
      { label: 'Check Toycra for the discount code',         sub: 'ABHINAV12. You already knew.',     value: 'savvy'   },
      { label: 'Screenshot and send to your partner',        sub: 'Hope is a strategy.',              value: 'hopeful' },
    ],
  },
];

// ── Outcomes ───────────────────────────────────────────────────────────────────
const OUTCOMES: Record<string, Outcome> = {
  technic: {
    theme: 'Technic', emoji: '⚙️',
    tagline: 'You build like an engineer. Because you probably are one.',
    desc: "Gear ratios, differentials, pneumatic systems — this is your language. You do not just want a model, you want to understand how it works. Possibly better than the engineers who designed the real thing.",
    set: 'Technic Bugatti Chiron', setNum: '42151',
    why: 'Because if you are going to build a supercar, it should have a working 8-speed gearbox. Anything less is just sculpture.',
    accent: '#F7A800',
  },
  creator: {
    theme: 'Creator Expert', emoji: '🏛️',
    tagline: 'You do not build sets. You acquire statement pieces.',
    desc: "Your shelf is curated. Your lighting is intentional. You have googled 'LEGO display case India' at least once. The build is almost secondary.",
    set: 'Eiffel Tower', setNum: '10307',
    why: '10001 pieces. 1.5 metres tall. Absolutely unhinged. Exactly your energy.',
    accent: '#F7A800',
  },
  city: {
    theme: 'City', emoji: '🏙️',
    tagline: 'You build for joy. Which is, objectively, the correct reason.',
    desc: "You might have kids. You might not. Either way City sets are the ones that make you forget time exists. There is something deeply satisfying about a miniature world that just works.",
    set: 'City Police Station', setNum: '60316',
    why: 'A whole ecosystem in one box. Also the little police motorbike is disproportionately satisfying to build.',
    accent: '#138808',
  },
  icons: {
    theme: 'LEGO Icons', emoji: '🤖',
    tagline: 'Childhood called. You answered. Immediately.',
    desc: "Icons sets are for people who grew up with something — a cartoon, a car, a moment — and never quite got over it. LEGO understood this and turned it into a product line.",
    set: 'Optimus Prime', setNum: '10302',
    why: 'It transforms. An adult LEGO set. That transforms. Into a truck. Back into Optimus. This is not a drill.',
    accent: '#006CB7',
  },
  architecture: {
    theme: 'Architecture', emoji: '🏗️',
    tagline: 'Small sets. Big taste. Absolutely no shelf space left.',
    desc: "You appreciate restraint. Clean lines. The fact that someone distilled the Burj Khalifa into 1460 pieces and made it look elegant. You probably have opinions about fonts too.",
    set: 'Singapore', setNum: '21057',
    why: "Asia's most recognisable skyline fits on any desk and yes the Marina Bay Sands is in there.",
    accent: '#006CB7',
  },
  starwars: {
    theme: 'Star Wars', emoji: '🚀',
    tagline: 'The Force was strong. The nostalgia stronger.',
    desc: "You watched A New Hope at an age that permanently rewired your brain. Now you are an adult with disposable income and very specific opinions about Millennium Falcon accuracy.",
    set: 'Millennium Falcon', setNum: '75257',
    why: 'It is the Falcon. You already wanted it before you started this quiz. We both know this.',
    accent: '#E3000B',
  },
  ideas: {
    theme: 'LEGO Ideas', emoji: '🌿',
    tagline: 'You want LEGO to have a personality. It does. It picked you.',
    desc: "LEGO Ideas sets are built by fans for fans. They are weird, specific, and wonderful. You do not build what is popular — you build what is interesting.",
    set: 'Tiny Plants', setNum: '21338',
    why: 'Succulents that do not die. A fiddle-leaf fig that will never disappoint you. Deeply therapeutic to build.',
    accent: '#138808',
  },
  speed: {
    theme: 'Speed Champions', emoji: '🏎️',
    tagline: 'Fast builds. Faster cars. Maximum desk credibility per rupee spent.',
    desc: "You are decisive. You know what you like. You would rather have three Speed Champions on your desk than one bloated set. Also you probably have a favourite F1 team.",
    set: 'Ferrari 812 Competizione', setNum: '76914',
    why: 'Because it is a Ferrari. Because it is red. Because Schumacher. No further questions.',
    accent: '#E3000B',
  },
};

// ── Routing ────────────────────────────────────────────────────────────────────
function getResult(a: Answers): Outcome {
  const { budget, goal, saturday, bigset } = a;
  if (budget === 'ultra' && saturday === 'solver')                              return OUTCOMES.technic;
  if (budget === 'ultra' && (goal === 'display' || saturday === 'aesthetic'))   return OUTCOMES.creator;
  if ((budget === 'low' || budget === 'mid') && saturday === 'family')          return OUTCOMES.city;
  if (saturday === 'nostalgic' && (goal === 'display' || goal === 'rebuild'))   return OUTCOMES.icons;
  if (goal === 'photo' && (budget === 'mid' || budget === 'low'))               return OUTCOMES.architecture;
  if (budget === 'high' && saturday === 'solver')                               return OUTCOMES.technic;
  if (goal === 'play' && saturday === 'family')                                 return OUTCOMES.city;
  if (saturday === 'nostalgic')                                                 return OUTCOMES.starwars;
  if (goal === 'photo' || saturday === 'aesthetic')                             return OUTCOMES.ideas;
  if (budget === 'low' || budget === 'mid')                                     return OUTCOMES.speed;
  if (bigset === 'emi' || bigset === 'ritual')                                  return OUTCOMES.creator;
  return OUTCOMES.starwars;
}

const STORES = [
  { name: 'Toycra',       url: 'https://toycra.com',       note: 'use code ABHINAV12' },
  { name: 'MyBrickHouse', url: 'https://mybrickhouse.in',  note: null },
  { name: 'Jaiman Toys',  url: 'https://jaimantoys.com',   note: null },
];

// ── Component ──────────────────────────────────────────────────────────────────
export default function WhichSetPage() {
  const [step,    setStep]    = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [hovered, setHovered] = useState<string | null>(null);

  const total    = QUESTIONS.length;
  const isIntro  = step === 0;
  const isResult = step > total;
  const currentQ = QUESTIONS[step - 1];
  const progress = isResult ? 100 : Math.round(((step - 1) / total) * 100);
  const result   = isResult ? getResult(answers) : null;

  function pick(qId: string, value: string) {
    const next = { ...answers, [qId]: value };
    setAnswers(next);
    setStep(s => s + 1);
  }

  function restart() { setAnswers({}); setStep(0); }

  return (
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: 'var(--font-inter), sans-serif', color: '#1A1A1A', padding: '40px 24px 80px' }}>
      <div style={{ maxWidth: 620, margin: '0 auto' }}>

        {/* Back link + title */}
        <div style={{ marginBottom: 32 }}>
          <Link href="/lab" style={{ color: '#006CB7', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>← The Lab</Link>
          <h1 style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, fontSize: 'clamp(1.8rem, 5vw, 2.4rem)', color: '#1A1A1A', margin: '8px 0 4px' }}>Which LEGO Set Are You?</h1>
          <p style={{ color: '#4A5568', fontSize: '0.88rem', margin: 0 }}>A short quiz that judges your taste and recommends a set.</p>
        </div>

        {/* Progress bar */}
        {!isIntro && !isResult && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#4A5568', marginBottom: 6 }}>
              <span>Question {step} of {total}</span>
              <span>{progress}%</span>
            </div>
            <div style={{ height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 99 }}>
              <div style={{ height: '100%', width: `${progress}%`, background: '#F7A800', borderRadius: 99, transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}

        {/* ── Intro ── */}
        {isIntro && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎯</div>
            <p style={{ color: '#4A5568', fontSize: '1rem', lineHeight: 1.75, maxWidth: 460, margin: '0 auto 32px' }}>
              Five questions. No wrong answers. Mostly. We will tell you exactly which LEGO set matches your personality, budget, and the fact that you have googled &ldquo;LEGO price India&rdquo; more than once this week.
            </p>
            <button onClick={() => setStep(1)}
              style={{ background: '#F7A800', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 40px', fontFamily: 'var(--font-fredoka)', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer' }}>
              Start the Quiz →
            </button>
          </div>
        )}

        {/* ── Question ── */}
        {!isIntro && !isResult && currentQ && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, fontSize: '1.5rem', color: '#1A1A1A', margin: '0 0 6px' }}>{currentQ.q}</h2>
              <p style={{ color: '#4A5568', fontSize: '0.86rem', margin: 0, fontStyle: 'italic' }}>{currentQ.sub}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentQ.options.map(opt => (
                <button key={opt.value}
                  onClick={() => pick(currentQ.id, opt.value)}
                  onMouseEnter={() => setHovered(opt.value)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    background: '#fff',
                    border: `2px solid ${hovered === opt.value ? '#F7A800' : 'rgba(0,0,0,0.08)'}`,
                    borderRadius: 12, padding: '14px 18px', textAlign: 'left',
                    cursor: 'pointer', transition: 'border-color 0.15s', width: '100%',
                  }}>
                  <div style={{ fontWeight: 600, fontSize: '0.93rem', color: '#1A1A1A' }}>{opt.label}</div>
                  <div style={{ fontSize: '0.78rem', color: '#4A5568', marginTop: 2 }}>{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Result ── */}
        {isResult && result && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: '4.5rem', marginBottom: 12 }}>{result.emoji}</div>
              <div style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, fontSize: '1rem', color: result.accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                {result.theme}
              </div>
              <h2 style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, fontSize: 'clamp(1.4rem, 4vw, 1.9rem)', color: '#1A1A1A', margin: '0 0 12px', lineHeight: 1.2 }}>
                {result.tagline}
              </h2>
              <p style={{ color: '#4A5568', fontSize: '0.93rem', lineHeight: 1.75, maxWidth: 500, margin: '0 auto' }}>{result.desc}</p>
            </div>

            {/* Set card */}
            <div style={{ background: '#fff', border: `2px solid ${result.accent}`, borderRadius: 16, padding: '20px 22px', marginBottom: 22 }}>
              <div style={{ fontSize: '0.68rem', color: '#4A5568', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>Our pick for you</div>
              <div style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, fontSize: '1.25rem', color: '#1A1A1A' }}>{result.set}</div>
              <div style={{ fontSize: '0.78rem', color: '#4A5568', marginBottom: 10 }}>Set #{result.setNum}</div>
              <p style={{ fontSize: '0.86rem', color: '#4A5568', fontStyle: 'italic', lineHeight: 1.65, margin: 0 }}>{result.why}</p>
            </div>

            {/* Store links */}
            <div style={{ marginBottom: 26 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1A1A1A', marginBottom: 10 }}>Where to buy in India</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {STORES.map(store => (
                  <a key={store.name} href={store.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1.5px solid #F7A800', borderRadius: 10, textDecoration: 'none', color: '#1A1A1A', fontWeight: 600, fontSize: '0.86rem' }}>
                    <span>{store.name}</span>
                    {store.note && <span style={{ fontSize: '0.73rem', color: '#F7A800', fontWeight: 700 }}>{store.note}</span>}
                  </a>
                ))}
              </div>
            </div>

            {/* Retake */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <button onClick={restart}
                style={{ background: 'none', border: '2px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: '10px 28px', fontWeight: 600, fontSize: '0.86rem', cursor: 'pointer', color: '#4A5568' }}>
                Retake the Quiz
              </button>
            </div>

            <p style={{ fontSize: '0.63rem', color: '#CBD5E0', textAlign: 'center', lineHeight: 1.55 }}>
              LEGO® is a trademark of the LEGO Group, which does not sponsor, authorise or endorse this quiz. Set recommendations are editorial opinions. Prices vary by store and date.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
