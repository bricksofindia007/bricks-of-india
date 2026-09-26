#!/usr/bin/env python3
"""
check_migration_grants.py -- issue #182 (Supabase Data API grants change,
effective 2026-10-30: new public tables get NO automatic grants, including
tables re-created by `supabase db reset` / preview branches).

Two checks over supabase/migrations/*.sql:

1. Per changed file (paths given on argv -- the PR's added/modified
   migrations): every CREATE TABLE in the public schema must be followed by
   at least one explicit GRANT ... ON [TABLE] <that table> TO <role> in the
   SAME file. A migration that creates a public table without one fails.
2. Whole directory: every public table any migration creates must have a
   GRANT somewhere in the directory (so the existing set stays covered).

Both modes also reject blanket anon access: GRANT ALL ... TO anon, or
GRANT ... ON ALL TABLES IN SCHEMA ... TO anon. Grants must match RLS intent
-- anon gets SELECT on genuinely public-read tables at most. A migration that
truly needs more for anon must say so on the GRANT line with
`-- anon-grant-ok: <reason>` for a human reviewer to see.

Usage:
  python .github/scripts/check_migration_grants.py                 # whole directory only
  python .github/scripts/check_migration_grants.py file1.sql ...   # + per-file check for these
Exit 1 on any violation.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

MIGRATIONS = Path(__file__).resolve().parents[2] / 'supabase' / 'migrations'

CREATE_RE = re.compile(
    r'create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?(?P<schema>\w+)"?\s*\.\s*)?"?(?P<table>\w+)"?',
    re.I,
)
GRANT_RE = re.compile(r'grant\s+(?P<privs>.+?)\s+on\s+(?P<target>.+?)\s+to\s+(?P<roles>[^;]+);', re.I | re.S)


def _strip_comments(sql: str) -> str:
    sql = re.sub(r'/\*.*?\*/', ' ', sql, flags=re.S)
    return re.sub(r'--[^\n]*', ' ', sql)


def public_tables_created(sql: str) -> list[str]:
    out = []
    for m in CREATE_RE.finditer(_strip_comments(sql)):
        schema = (m.group('schema') or 'public').lower()
        if schema == 'public' and m.group('table').lower() not in ('if',):
            out.append(m.group('table').lower())
    return out


def grants(sql: str) -> list[dict]:
    """[{tables: set, roles: set, privs: str, line_ok: bool}] -- line_ok if the
    raw GRANT carried an '-- anon-grant-ok:' justification."""
    out = []
    raw = sql
    for m in GRANT_RE.finditer(_strip_comments(sql)):
        target = m.group('target').strip()
        if re.match(r'(function|procedure|routine|sequence|schema|all\s+(functions|sequences|routines))\b', target, re.I):
            continue  # not a table grant -- out of scope for this check
        target = re.sub(r'^table\s+', '', target, flags=re.I)
        tables = set()
        all_in_schema = bool(re.match(r'all\s+tables\s+in\s+schema', target, re.I))
        if not all_in_schema:
            for t in target.split(','):
                t = t.strip().strip('"')
                if t:
                    tables.add(t.split('.')[-1].strip('"').lower())
        roles = {r.strip().strip('"').lower() for r in m.group('roles').split(',')}
        out.append({
            'tables': tables, 'roles': roles, 'privs': m.group('privs').strip().lower(),
            'all_in_schema': all_in_schema,
        })
    ok_lines = len(re.findall(r'--\s*anon-grant-ok:', raw, re.I))
    for g in out:
        g['justified'] = ok_lines > 0
    return out


def blanket_anon_violations(fname: str, gs: list[dict]) -> list[str]:
    errs = []
    for g in gs:
        if 'anon' not in g['roles'] or g['justified']:
            continue
        if g['all_in_schema']:
            errs.append(f'{fname}: GRANT ... ON ALL TABLES IN SCHEMA ... TO anon is a blanket grant')
        elif g['privs'].startswith('all'):
            errs.append(f'{fname}: GRANT ALL ... TO anon on {sorted(g["tables"])} is a blanket grant')
        elif set(p.strip() for p in g['privs'].split(',')) - {'select'}:
            errs.append(f'{fname}: anon granted {g["privs"].upper()} on {sorted(g["tables"])} -- '
                        f'anon should get SELECT at most (add "-- anon-grant-ok: <reason>" if truly intended)')
    return errs


def main(argv: list[str]) -> int:
    files = sorted(MIGRATIONS.glob('*.sql'))
    errors: list[str] = []
    all_granted: set[str] = set()
    created: dict[str, str] = {}

    for f in files:
        sql = f.read_text(encoding='utf-8', errors='replace')
        gs = grants(sql)
        for g in gs:
            all_granted |= g['tables']
        for t in public_tables_created(sql):
            created.setdefault(t, f.name)

    # 1. per changed file
    for arg in argv:
        p = Path(arg)
        if p.suffix != '.sql' or not p.exists():
            continue
        sql = p.read_text(encoding='utf-8', errors='replace')
        gs = grants(sql)
        granted_here = set().union(*[g['tables'] for g in gs]) if gs else set()
        for t in public_tables_created(sql):
            if t not in granted_here:
                errors.append(f'{p.name}: creates public.{t} with no explicit GRANT in the same migration '
                              f'(required from 2026-10-30 -- see issue #182)')
        errors.extend(blanket_anon_violations(p.name, gs))

    # 2. whole directory
    for t, fname in sorted(created.items()):
        if t not in all_granted:
            errors.append(f'{fname}: public.{t} has no GRANT anywhere in supabase/migrations/')
    for f in files:
        errors.extend(blanket_anon_violations(f.name, grants(f.read_text(encoding='utf-8', errors='replace'))))

    print(f'Scanned {len(files)} migration(s); {len(created)} public table(s) created; '
          f'{len(argv)} file(s) checked per-file.')
    if errors:
        for e in dict.fromkeys(errors):
            print(f'::error::{e}')
        return 1
    print('PASS: every public table created in supabase/migrations/ has an explicit GRANT; no blanket anon grants.')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
