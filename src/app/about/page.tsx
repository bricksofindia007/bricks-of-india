import type { Metadata } from 'next';
import Image from 'next/image';
import { JsonLd } from '@/components/JsonLd';
import { personSchema } from '@/lib/schemas';
import { BRAND, MASCOTS } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'About Abhinav Bhargav — Founder, Bricks of India',
  description:
    "Meet Abhinav Bhargav, founder of Bricks of India. 20+ years in enterprise sales, marketing, and account management. Cornell University. Building India's first LEGO price comparison site.",
  alternates: { canonical: 'https://bricksofindia.com/about' },
};


function YouTubeIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23.5 6.2c-.3-1-1-1.8-2-2.1C19.7 3.7 12 3.7 12 3.7s-7.7 0-9.5.4c-1 .3-1.7 1.1-2 2.1C0 8 0 12 0 12s0 4 .5 5.8c.3 1 1 1.8 2 2.1C4.3 20.3 12 20.3 12 20.3s7.7 0 9.5-.4c1-.3 1.7-1.1 2-2.1C24 16 24 12 24 12s0-4-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.2c3.2 0 3.6 0 4.8.1 3.2.1 4.7 1.7 4.8 4.8.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.1-1.6 4.7-4.8 4.8-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1C3.9 21.4 2.4 19.8 2.3 16.7 2.2 15.5 2.2 15.1 2.2 12s0-3.6.1-4.8C2.4 4.1 3.9 2.5 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.4 2.6 6.8 7 7 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9C23.7 2.7 21.3.3 16.9.1 15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 100 12.4A6.2 6.2 0 0012 5.8zm0 10.2a4 4 0 110-8 4 4 0 010 8zm6.4-11.8a1.4 1.4 0 100 2.8 1.4 1.4 0 000-2.8z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

export default function AboutPage() {
  return (
    <div className="bg-white min-h-screen">
      <JsonLd data={personSchema} />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section
        className="py-14 px-4"
        style={{
          background:
            'linear-gradient(180deg, var(--boi-sky) 0%, var(--boi-sky-light) 100%)',
        }}
      >
        <div className="max-w-site mx-auto flex flex-col md:flex-row items-center gap-10">
          {/* Mascot image */}
          <div
            className="shrink-0 rounded-2xl overflow-hidden border-4"
            style={{
              width: '240px',
              height: '240px',
              minWidth: '240px',
              borderColor: 'var(--boi-navy)',
            }}
          >
            <Image
              src={MASCOTS.both.about}
              alt="Bricks of India mascots"
              width={240}
              height={240}
              className="w-full h-full object-cover"
              priority
            />
          </div>

          {/* Name + title */}
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-fredoka)',
                fontWeight: 700,
                fontSize: 'clamp(2.2rem, 5vw, 3.5rem)',
                color: 'var(--boi-navy)',
                lineHeight: 1.1,
                marginBottom: '6px',
              }}
            >
              Abhinav Bhargav
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-fredoka)',
                fontWeight: 700,
                fontSize: '1.2rem',
                color: 'var(--boi-red)',
                marginBottom: '20px',
              }}
            >
              Founder, Bricks of India
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={BRAND.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-semibold px-5 py-2.5 rounded-xl transition-opacity hover:opacity-80"
                style={{
                  background: '#FF0000',
                  color: '#fff',
                  fontFamily: 'var(--font-fredoka)',
                  fontSize: '1rem',
                  fontWeight: 700,
                }}
              >
                <YouTubeIcon />
                Subscribe on YouTube
              </a>
              <a
                href={BRAND.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-opacity hover:opacity-80"
                style={{
                  background: 'var(--boi-navy)',
                  color: '#fff',
                  fontFamily: 'var(--font-inter)',
                }}
              >
                <InstagramIcon />
                Instagram
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-site mx-auto px-4 py-12">
        <div className="max-w-3xl">

          {/* ── Bio ─────────────────────────────────────────────────────────── */}
          <section className="mb-12">
            <div
              className="space-y-5 leading-relaxed"
              style={{
                fontFamily: 'var(--font-inter)',
                fontSize: '1.05rem',
                color: '#3a3a3a',
                lineHeight: 1.8,
              }}
            >
              <p>
                I&apos;m Abhinav Bhargav. For the past two decades I&apos;ve led commercial teams
                in enterprise sales, marketing, and account management — running multi-million-dollar
                P&amp;Ls, managing international teams, and pretending I know what &ldquo;alignment&rdquo;
                means on a Monday morning call. Somewhere along the way I also went to Cornell
                University, which was considerably harder than the Monday morning calls.
              </p>
              <p>
                I&apos;m also, embarrassingly, obsessed with LEGO. I own a Concorde in LEGO AND a
                Concorde in COBI, which is the kind of behaviour that should probably concern my
                family and definitely concerns my wallet. My daughter thinks it&apos;s normal.
                She&apos;s wrong.
              </p>
              <p>
                Bricks of India exists because I got tired of Googling &ldquo;LEGO price India&rdquo;
                and getting results from 2019, three British websites, a Norwegian AFOL, and zero
                rupees mentioned anywhere. Indian LEGO buyers deserve better. So this is my attempt
                at better — honest prices from Indian stores, reviews without PR spin, news written
                by someone who knows what ₹6,499 actually feels like when your EMI is also due
                that week.
              </p>
              <p>
                In August 2025, I started Bricks of India — first as a YouTube channel (and Instagram
                page) about LEGO, India, and the financial decisions one makes at 2am with a credit
                card in hand — and then this website, because apparently one outlet for obsession
                is never enough.
              </p>
              <p>
                Welcome in. Try not to empty your wallet. I&apos;m told that&apos;s part of the fun.
              </p>
            </div>
          </section>

          {/* ── Credentials ─────────────────────────────────────────────────── */}
          <section className="mb-12">
            <h2
              className="font-heading mb-6"
              style={{ color: 'var(--boi-navy)', fontSize: '1.75rem' }}
            >
              Credentials &amp; background
            </h2>
            <div className="space-y-3">
              {[
                {
                  icon: '🎓',
                  title: 'Cornell University',
                  detail: null,
                },
                {
                  icon: '💼',
                  title: '20+ years in enterprise sales, marketing, and account management',
                  detail: null,
                },
                {
                  icon: '🎬',
                  title: 'LEGO content creator on YouTube and Instagram since 2024',
                  detail: null,
                },
              ].map(({ icon, title, detail }) => (
                <div
                  key={title}
                  className="flex items-start gap-4 p-4 rounded-xl"
                  style={{
                    background: 'rgba(126,196,232,0.1)',
                    border: '1.5px solid rgba(126,196,232,0.4)',
                  }}
                >
                  <span className="text-2xl shrink-0">{icon}</span>
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--font-fredoka)',
                        fontWeight: 700,
                        fontSize: '16px',
                        color: 'var(--boi-navy)',
                      }}
                    >
                      {title}
                    </div>
                    {detail && (
                      <div
                        style={{
                          fontFamily: 'var(--font-inter)',
                          fontSize: '14px',
                          color: '#666',
                          marginTop: '2px',
                        }}
                      >
                        {detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Find me here ────────────────────────────────────────────────── */}
          <section className="mb-12">
            <h2
              className="font-heading mb-5"
              style={{ color: 'var(--boi-navy)', fontSize: '1.75rem' }}
            >
              Find me here
            </h2>
            <div className="flex flex-col gap-3">
              <a
                href={BRAND.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 font-bold px-6 py-4 rounded-xl transition-opacity hover:opacity-80 max-w-xs"
                style={{
                  background: '#FF0000',
                  color: '#fff',
                  fontFamily: 'var(--font-fredoka)',
                  fontSize: '1.1rem',
                }}
              >
                <YouTubeIcon />
                Subscribe — @BricksofIndia
              </a>
              <a
                href={BRAND.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 text-sm font-semibold px-5 py-3 rounded-xl transition-opacity hover:opacity-80 max-w-xs"
                style={{
                  background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
                  color: '#fff',
                  fontFamily: 'var(--font-inter)',
                }}
              >
                <InstagramIcon />
                @bricksofindia on Instagram
              </a>
              <a
                href="mailto:abhinav@bricksofindia.com"
                className="inline-flex items-center gap-3 text-sm font-semibold px-5 py-3 rounded-xl transition-opacity hover:opacity-80 max-w-xs"
                style={{
                  background: 'var(--boi-navy)',
                  color: '#fff',
                  fontFamily: 'var(--font-inter)',
                }}
              >
                <MailIcon />
                abhinav@bricksofindia.com
              </a>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
