import type { MetadataRoute } from 'next'

/**
 * Bricks of India robots.txt declaration
 *
 * Policy: Allow crawlers that send referral traffic; block crawlers
 * that take content for training without giving anything back.
 *
 * Enforcement layer: Cloudflare AI Crawl Control (per-crawler
 * allow/block at the WAF). This file declares the same policy at
 * the robots.txt layer for well-behaved crawlers that check it first.
 *
 * Last reviewed: 2026-05-01
 * Tracker reference: GEO-02, ROBOTS-01
 */

const SITE_URL = 'https://bricksofindia.com'

// Crawlers we want to allow — they send referral traffic or are
// traditional search engines
const ALLOWED_AI_CRAWLERS = [
  'OAI-SearchBot',       // OpenAI search index → ChatGPT search
  'ChatGPT-User',        // OpenAI live fetch
  'PerplexityBot',       // Perplexity search index
  'Perplexity-User',     // Perplexity live fetch
  'Claude-SearchBot',    // Anthropic search/browsing
  'Claude-User',         // Anthropic live fetch
  'Applebot',            // Apple Intelligence + Spotlight
  'MistralAI-User',      // Mistral live fetch
  'DuckAssistBot',       // DuckDuckGo AI assistant
]

// Crawlers we explicitly block — training-only with no referral benefit
const BLOCKED_AI_CRAWLERS = [
  'GPTBot',              // OpenAI training
  'ClaudeBot',           // Anthropic training
  'anthropic-ai',        // Anthropic training (legacy UA)
  'CCBot',               // Common Crawl (used in many training pipelines)
  'Bytespider',          // ByteDance training
  'Google-Extended',     // Google AI training (does not affect Googlebot)
  'Applebot-Extended',   // Apple AI training (does not affect Applebot)
  'Meta-ExternalAgent',  // Meta AI training
  'FacebookBot',         // Meta AI training (despite name)
  'Amazonbot',           // Amazon AI training
  'PetalBot',            // Huawei AI training
  'cohere-ai',           // Cohere training
  'TikTok-Spider',       // ByteDance training
]

export default function robots(): MetadataRoute.Robots {
  const rules: MetadataRoute.Robots['rules'] = [
    // Allow standard search engines + curated AI search bots
    {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/'],
    },
    // Explicit allows for AI search bots (redundant with * allow but
    // makes intent visible to anyone reading the file)
    ...ALLOWED_AI_CRAWLERS.map((ua) => ({
      userAgent: ua,
      allow: '/',
      disallow: ['/admin/', '/api/'],
    })),
    // Explicit blocks for training-only AI crawlers
    ...BLOCKED_AI_CRAWLERS.map((ua) => ({
      userAgent: ua,
      disallow: '/',
    })),
  ]

  return {
    rules,
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
