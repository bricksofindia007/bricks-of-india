// Pure helpers for db-migrate's only_version input (order 0010 item 8). No I/O. Apply exactly one named pending migration;
// every other pending migration stays held, and the parity rule allows exactly that held set to remain unapplied.

/** Chooses the one named migration. Refuses unless the version is pending exactly once. */
export function selectOnlyVersion({ pendingMigrations, onlyVersion, versionOf }) {
  const want = String(onlyVersion ?? '').trim();
  if (!want) return { apply: pendingMigrations, held: [] };
  const named = pendingMigrations.filter((f) => versionOf(f) === want);
  if (named.length !== 1) return { error: `only_version ${want}: not exactly one pending migration (found ${named.length}); refusing` };
  return { apply: named, held: pendingMigrations.filter((f) => versionOf(f) !== want) };
}

/** After an only_version apply: parity passes when the target has no version the repo lacks, and the still-unapplied set is exactly the held set. */
export function onlyVersionParity({ repoVersions, prodVersions, heldVersions }) {
  const prod = new Set(prodVersions);
  const repo = new Set(repoVersions);
  const unapplied = repoVersions.filter((v) => !prod.has(v));
  const prodOnly = prodVersions.filter((v) => !repo.has(v));
  const got = [...unapplied].sort().join(',');
  const want = [...heldVersions].sort().join(',');
  return { ok: prodOnly.length === 0 && got === want, prodOnly, unapplied, held: [...heldVersions] };
}