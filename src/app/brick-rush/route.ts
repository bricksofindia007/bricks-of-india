import { NextResponse } from 'next/server';
import { BRICK_RUSH } from '@/lib/sale-hub';

// Short URL for captions and descriptions (bricksofindia.com/brick-rush) -> the full-list article.
// Keeps working after the sale ends: the article stays published.
export function GET(request: Request) {
  return NextResponse.redirect(new URL(BRICK_RUSH.href, request.url), 307);
}
