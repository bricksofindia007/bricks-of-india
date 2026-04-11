'use client';

import Image from 'next/image';
import { useState } from 'react';
import { MASCOTS, BRAND } from '@/lib/brand';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    // Form submission — in production, connect to a serverless function or Supabase
    await new Promise((r) => setTimeout(r, 1000));
    setStatus('success');
  };

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-light-grey py-12 px-4 border-b-2 border-dark">
        <div className="max-w-site mx-auto flex items-center gap-6">
          <div className="flex-1">
            <h1 className="font-heading text-dark text-6xl mb-2">GET IN TOUCH</h1>
            <p className="text-gray-500 font-body text-lg">
              We&apos;ll get back to you. Probably. Response time: faster than LEGO® India restocking popular sets.
            </p>
          </div>
          <Image src={MASCOTS.blue.welcome} alt="Contact us" width={160} height={160} className="object-contain shrink-0 hidden md:block" />
        </div>
      </div>

      <div className="max-w-site mx-auto px-4 py-12">
        <div className="max-w-xl">
          {status === 'success' ? (
            <div className="text-center py-16">
              <Image src={MASCOTS.blue.thumbsUp} alt="Message sent" width={150} height={150} className="mx-auto mb-4 object-contain" />
              <h2 className="font-heading text-dark text-4xl mb-3">MESSAGE SENT!</h2>
              <p className="text-gray-500 font-body">We&apos;ve received your message. We&apos;ll get back to you. Probably before your next LEGO® order arrives.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-dark mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border-2 border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
                  placeholder="Abhinav (probably)"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-dark mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border-2 border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-dark mb-1">Subject</label>
                <select
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full border-2 border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors bg-white"
                >
                  <option value="">Select a subject</option>
                  <option value="Partnership/Sponsorship">Partnership / Sponsorship</option>
                  <option value="Press">Press</option>
                  <option value="Technical Issue">Technical Issue</option>
                  <option value="General">General</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-dark mb-1">Message</label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full border-2 border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors resize-none"
                  placeholder="What's on your mind? LEGO-related or otherwise."
                />
              </div>
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-primary text-dark font-bold py-4 rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-50 text-lg"
              >
                {status === 'loading' ? 'Sending...' : 'Send Message →'}
              </button>
            </form>
          )}

          <div className="mt-8 flex gap-4">
            <a href={BRAND.youtube} target="_blank" rel="noopener noreferrer" className="text-accent-blue font-bold hover:underline text-sm">YouTube →</a>
            <a href={BRAND.instagram} target="_blank" rel="noopener noreferrer" className="text-accent-blue font-bold hover:underline text-sm">Instagram →</a>
          </div>
        </div>
      </div>
    </div>
  );
}
