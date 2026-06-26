'use server'

import { Resend } from 'resend'
import { z } from 'zod'
import { CONTACT_EMAIL } from '@/lib/contact-email'

const contactSchema = z.object({
  name:    z.string().min(2).max(100),
  email:   z.string().email().max(200),
  subject: z.string().min(2).max(200),
  message: z.string().min(10).max(5000),
  // Honeypot — must be empty. Bots fill every field they see.
  website: z.string().max(0, 'spam detected').optional().default(''),
})

export type ContactFormState = {
  ok: boolean
  error?: string
}

export async function submitContact(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = contactSchema.safeParse({
    name:    formData.get('name'),
    email:   formData.get('email'),
    subject: formData.get('subject'),
    message: formData.get('message'),
    website: formData.get('website') ?? '',
  })

  if (!parsed.success) {
    // Silent success on honeypot trip — don't tell the bot it failed
    if (parsed.error.issues.some((i) => i.path[0] === 'website')) {
      return { ok: true }
    }
    return { ok: false, error: 'Please check the form fields and try again.' }
  }

  const { name, email, subject, message } = parsed.data

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from:    'Bricks of India <abhinav@bricksofindia.com>',
      to:      CONTACT_EMAIL,
      replyTo: email,
      subject: `[Contact] ${subject}`,
      text:    `From: ${name} <${email}>\n\n${message}`,
    })
    return { ok: true }
  } catch (err) {
    console.error('[contact] send failed', err)
    return { ok: false, error: 'Could not send your message. Please try again later.' }
  }
}
