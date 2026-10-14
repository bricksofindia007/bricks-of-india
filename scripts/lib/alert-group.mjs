// Message builders for grouped scraper notices. Pure functions, no I/O, so they can be tested.

/**
 * One notice for every store held in this run, instead of one email per store.
 * A held store is a notice, not a failure: nothing was written for it, and the
 * fix is a person's check of the policy files, not a retry.
 */
export function heldNotice(notices, runUrl) {
  const names = notices.map((n) => n.name);
  const subject = `[BOI] Scrape held: ${names.join(', ')} (nothing written)`;
  const lines = [
    `Held in this run: ${notices.length} store(s). Nothing was written for them.`,
    '',
    ...notices.flatMap((n) => [
      `Store: ${n.name} (${n.id}), feed ${n.domain}${n.path ?? ''}`,
      `Reasons: ${n.reasons.join('; ')}`,
      '',
    ]),
    `Run: ${runUrl}`,
    '',
    'To approve one run for a store, run the scrape workflow with that store\'s approval key and the expected available count.',
  ];
  return { subject, body: lines.join('\n') };
}
