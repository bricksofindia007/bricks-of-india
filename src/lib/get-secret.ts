// Strip ALL BOM (U+FEFF) occurrences from environment secrets. Using explicit
// ﻿ Unicode escape rather than a literal BOM character, which compilers may strip.
// Strips globally (not just leading) because the GEMINI_API_KEY GitHub Secret
// was found to carry a BOM at position 7 — a mid-key occurrence that the
// original leading-only strip would not catch, producing "ByteString at index 7"
// errors in undici when the key lands in an x-goog-api-key header (HIGH-52, 2026-06-28).
export const getSecret = (name: string): string | undefined =>
  process.env[name]?.replace(/\uFEFF/g, '');
