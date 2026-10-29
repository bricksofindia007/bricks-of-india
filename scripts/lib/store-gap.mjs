// Store-name rule for article prices (technical-hygiene ContentIntegrity). Pure, so it is unit-testable
// (tests/store-gap.test.ts). An article is a gap only when it states a ₹ price, names no known store, and does not
// say the price is import-only or unofficial.
export const KNOWN_STORE_RE = /toycra|mybrickhouse|amazon|flipkart|lego india store/i;
export const NO_STORE_LANGUAGE_RE = /import.only|no official store price|no.+(official|indian).+price|not.+(officially|yet).+available.+india/i;

export function isStoreGap(content) {
  const c = content || '';
  if (!/₹[\d,]+/.test(c)) return false;          // no price at all -- not in scope
  if (KNOWN_STORE_RE.test(c)) return false;      // names at least one known store -- fine
  if (NO_STORE_LANGUAGE_RE.test(c)) return false; // explicitly acknowledges import-only / no official price -- fine
  return true;                                   // has a ₹ figure, no store name, no acknowledgement -- genuine gap
}
