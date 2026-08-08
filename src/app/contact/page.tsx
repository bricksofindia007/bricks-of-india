'use client'

import { Suspense } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { MASCOTS, BRAND } from '@/lib/brand'
import { submitContact, type ContactFormState } from '@/app/actions/contact'

const initial: ContactFormState = { ok: false }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-yellow-400 hover:text-dark transition-colors disabled:opacity-50 text-lg"
    >
      {pending ? 'Sending...' : 'Send Message'}
    </button>
  )
}

function ContactForm() {
  const searchParams = useSearchParams()
  const [state, action] = useFormState(submitContact, initial)

  if (state.ok) {
    return (
      <div className="text-center py-16">
        <Image
          src={MASCOTS.blue.thumbsUp}
          alt="Message sent"
          width={150}
          height={150}
          className="mx-auto mb-4 object-contain"
        />
        <h2 className="font-heading text-dark text-4xl mb-3">MESSAGE SENT!</h2>
        <p className="text-gray-500 font-body">
          We&apos;ve received your message. Reply usually within 48 hours.
        </p>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-5">
      {/* Honeypot — hidden from humans, filled by bots */}
      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <label className="block text-sm font-bold text-dark mb-1">Your Name</label>
        <input
          type="text"
          name="name"
          required
          minLength={2}
          maxLength={100}
          className="w-full border-2 border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
          placeholder="Abhinav (probably)"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-dark mb-1">Email Address</label>
        <input
          type="email"
          name="email"
          required
          maxLength={200}
          className="w-full border-2 border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
          placeholder="your@email.com"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-dark mb-1">Subject</label>
        <input
          type="text"
          name="subject"
          required
          minLength={2}
          maxLength={200}
          defaultValue={searchParams.get('subject') ?? ''}
          className="w-full border-2 border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
          placeholder="Partnership, spotlight pitch, technical issue..."
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-dark mb-1">Message</label>
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          className="w-full border-2 border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors resize-none"
          placeholder="What's on your mind? LEGO-related or otherwise."
        />
      </div>

      {state.error && (
        <p className="text-red-700 text-sm">{state.error}</p>
      )}

      <SubmitButton />
    </form>
  )
}

export default function ContactPage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="bg-light-grey py-12 px-4 border-b-2 border-dark">
        <div className="max-w-site mx-auto flex items-center gap-6">
          <div className="flex-1">
            <h1 className="font-heading text-dark text-6xl mb-2">GET IN TOUCH</h1>
            <p className="text-gray-500 font-body text-lg">
              We&apos;ll get back to you. Probably. Response time: faster than LEGO India
              restocking popular sets.
            </p>
          </div>
          <Image
            src={MASCOTS.blue.welcome}
            alt="Contact us"
            width={160}
            height={160}
            className="object-contain shrink-0 hidden md:block"
          />
        </div>
      </div>

      <div className="max-w-site mx-auto px-4 py-12">
        <div className="max-w-xl">
          <Suspense fallback={null}>
            <ContactForm />
          </Suspense>

          <div className="mt-8 flex gap-4">
            <a
              href={BRAND.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-blue font-bold hover:underline text-sm"
            >
              YouTube
            </a>
            <a
              href={BRAND.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-blue font-bold hover:underline text-sm"
            >
              Instagram
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
