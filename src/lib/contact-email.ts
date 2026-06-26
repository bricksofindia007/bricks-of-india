import 'server-only'

if (!process.env.CONTACT_EMAIL) {
  throw new Error('CONTACT_EMAIL environment variable is required')
}

export const CONTACT_EMAIL = process.env.CONTACT_EMAIL
