// Standee visit tags. A visit is counted only for a tag on the closed list (the same list the analytics code uses).
import { STANDEE_SOURCES } from '@/lib/analytics';

export const STANDEE_TAGS: readonly string[] = STANDEE_SOURCES;

/** True only for a tag on the closed list. Anything else is refused. */
export function isStandeeTag(value: unknown): value is string {
  return typeof value === 'string' && STANDEE_TAGS.includes(value);
}
