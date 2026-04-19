import type { Metadata } from 'next';
import Link from 'next/link';
import { Youtube, Instagram, Mail } from 'lucide-react';
import { SchemaLD } from '@/components/SchemaLD';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'About Abhinav Bhargav — Founder, Bricks of India',
  description:
    'Abhinav Bhargav is the founder of Bricks of India, India\'s first LEGO® price comparison site. 17+ years in Sales, Marketing and Account Management. Cornell University Talent Management program.',
  alternates: { canonical: 'https://bricksofindia.com/about' },
};

const personSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Abhinav Bhargav',
  jobTitle: 'Founder, Bricks of India',
  email: 'abhinav@bricksofindia.com',
  url: 'https://www.bricksofindia.com/about',
  sameAs: [
    'https://www.youtube.com/@BricksofIndia',
    'https://www.instagram.com/bricksofindia/',
  ],
  alumniOf: {
    '@type': 'EducationalOrganization',
    name: 'Cornell University',
  },
  worksFor: {
    '@type': 'Organization',
    name: 'Bricks of India',
  },
};

export default function AboutPage() {
  return (
    <div className="bg-white min-h-screen">
      <SchemaLD data={personSchema} />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section
        className="py-14 px-4"
        style={{ background: 'linear-gradient(180deg, var(--boi-sky) 0%, var(--boi-sky-light) 100%)' }}
      >
        <div className="max-w-site mx-auto flex flex-col md:flex-row items-center gap-10">
          {/* Photo placeholder */}
          <div
            className="shrink-0 rounded-2xl overflow-hidden border-4 flex items-center justify-center"
            style={{
              width: '200px',
              height: '200px',
              borderColor: 'var(--boi-navy)',
              background: 'rgba(26,35,50,0.1)',
            }}
          >
            <div
              className="text-center"
              style={{ fontFamily: 'var(--font-fredoka)', color: 'var(--boi-navy)', opacity: 0.5 }}
            >
              <div style={{ fontSize: '48px', lineHeight: 1 }}>🧱</div>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>Photo coming soon</div>
            </div>
          </div>

          {/* Name + title */}
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-fredoka)',
                fontWeight: 700,
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                color: 'var(--boi-navy)',
                lineHeight: 1.1,
              }}
            >
              Abhinav Bhargav
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-inter)',
                fontWeight: 600,
                fontSize: '18px',
                color: 'var(--boi-navy)',
                opacity: 0.75,
                marginTop: '4px',
              }}
            >
              Founder, Bricks of India
            </p>
            <div className="flex flex-wrap gap-3 mt-5">
              <a
                href={BRAND.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-semibold text-sm px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
                style={{ background: 'var(--boi-red)', color: '#fff', fontFamily: 'var(--font-inter)' }}
              >
                <Youtube className="w-4 h-4" /> YouTube
              </a>
              <a
                href={BRAND.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-semibold text-sm px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
                style={{ background: 'var(--boi-navy)', color: '#fff', fontFamily: 'var(--font-inter)' }}
              >
                <Instagram className="w-4 h-4" /> Instagram
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-site mx-auto px-4 py-12">
        <div className="max-w-3xl">

          {/* ── Bio ────────────────────────────────────────────────────────── */}
          <section className="mb-12">
            <h2 className="font-heading mb-4" style={{ color: 'var(--boi-navy)', fontSize: '2rem' }}>
              About
            </h2>
            <div
              className="space-y-4 leading-relaxed"
              style={{ fontFamily: 'var(--font-inter)', fontSize: '1.05rem', color: '#444', lineHeight: 1.75 }}
            >
              <p>
                Hi, I&apos;m Abhinav. I&apos;ve spent 17+ years working in Sales, Marketing, and Account
                Management across B2B and consumer categories. In 2025 I moved into full-time
                freelancing, and alongside that work I run Bricks of India — India&apos;s first
                honest LEGO® price comparison and review site.
              </p>
              <p>
                I completed the Talent Management program at Cornell University, which gave me a
                solid grounding in how people learn, communicate, and make decisions. That&apos;s
                informed a lot of how I write about LEGO: plainly, with an opinion, and with
                the Indian buyer&apos;s wallet in mind.
              </p>
              <p>
                I launched the Bricks of India YouTube channel and website in 2024 because I was
                frustrated by the lack of India-specific LEGO content. Prices vary wildly between
                stores. Import duties are opaque. Reviews are almost always written from a US or UK
                perspective and don&apos;t account for what Indian buyers actually pay.
                Bricks of India exists to fix that.
              </p>
            </div>
          </section>

          {/* ── Credentials ────────────────────────────────────────────────── */}
          <section className="mb-12">
            <h2 className="font-heading mb-6" style={{ color: 'var(--boi-navy)', fontSize: '2rem' }}>
              Credentials
            </h2>
            <div className="space-y-4">
              {[
                {
                  icon: '🎓',
                  title: 'Cornell University',
                  detail: 'Talent Management program',
                },
                {
                  icon: '💼',
                  title: '17+ years experience',
                  detail: 'Enterprise Sales, Marketing, and Account Management',
                },
                {
                  icon: '🎬',
                  title: 'LEGO content creator since 2024',
                  detail: 'YouTube + Instagram — reviews, price comparisons, India LEGO news',
                },
              ].map(({ icon, title, detail }) => (
                <div
                  key={title}
                  className="flex items-start gap-4 p-4 rounded-xl"
                  style={{ background: 'rgba(126,196,232,0.1)', border: '1.5px solid rgba(126,196,232,0.4)' }}
                >
                  <span className="text-2xl shrink-0 mt-0.5">{icon}</span>
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
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Mission ──────────────────────────────────────────────────────── */}
          <section
            className="mb-12 rounded-2xl p-8"
            style={{ background: 'var(--boi-navy)' }}
          >
            <h2
              className="font-heading mb-4"
              style={{ color: 'var(--boi-yellow)', fontSize: '2rem' }}
            >
              What Bricks of India does
            </h2>
            <div
              className="space-y-2.5"
              style={{ fontFamily: 'var(--font-inter)', fontSize: '15px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}
            >
              <p>✅ Compare LEGO prices across all major Indian stores — updated every 6 hours</p>
              <p>✅ Review sets honestly, with actual opinions and India price context</p>
              <p>✅ Deliver LEGO news written from an India perspective</p>
              <p>✅ Save Indian LEGO fans money with exclusive deals (use code ABHINAV12 at Toycra)</p>
              <p>✅ Be genuinely useful, not just another content farm</p>
            </div>
          </section>

          {/* ── Contact ──────────────────────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="font-heading mb-4" style={{ color: 'var(--boi-navy)', fontSize: '2rem' }}>
              Get in touch
            </h2>
            <a
              href="mailto:abhinav@bricksofindia.com"
              className="inline-flex items-center gap-3 font-semibold text-base px-6 py-3 rounded-xl transition-opacity hover:opacity-80"
              style={{
                background: 'var(--boi-navy)',
                color: '#fff',
                fontFamily: 'var(--font-inter)',
              }}
            >
              <Mail className="w-5 h-5" />
              abhinav@bricksofindia.com
            </a>
          </section>

        </div>
      </div>
    </div>
  );
}
