// Strip leading BOM (U+FEFF) from environment secrets. Some secret managers
// and editors prepend one, causing "Cannot convert to ByteString" errors when
// the value lands in an Authorization header.
export const getSecret = (name: string): string | undefined =>
  process.env[name]?.replace(/^﻿/, '');
