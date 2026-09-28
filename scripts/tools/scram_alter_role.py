"""
Print an ALTER ROLE statement that sets a password as a pre-computed SCRAM-SHA-256 verifier
(P8 item 1; the same method used for ci_readonly in #400).

The plaintext never reaches Postgres or its statement log (production runs log_statement=ddl):
only the verifier (salted, 4096-iteration PBKDF2) appears in the statement. This script never
prints the password itself (G17).

  python scripts/tools/scram_alter_role.py <role> <path-to-file-containing-the-new-password>

The file holds the password on its first line (surrounding whitespace is stripped). Keep that
file outside the repo and delete it once every location holding the credential is updated.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
import sys

ITERATIONS = 4096


def scram_verifier(password: str, salt: bytes | None = None, iterations: int = ITERATIONS) -> str:
    salt = salt if salt is not None else secrets.token_bytes(16)
    salted = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, iterations)
    client_key = hmac.new(salted, b'Client Key', hashlib.sha256).digest()
    server_key = hmac.new(salted, b'Server Key', hashlib.sha256).digest()
    stored_key = hashlib.sha256(client_key).digest()
    b64 = lambda b: base64.b64encode(b).decode()
    return f'SCRAM-SHA-256${iterations}:{b64(salt)}${b64(stored_key)}:{b64(server_key)}'


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    role, path = argv[1], argv[2]
    if not re.fullmatch(r'[a-z_][a-z0-9_]{0,62}', role):
        print('role must be a plain lowercase identifier', file=sys.stderr)
        return 2
    with open(path, encoding='utf-8') as f:
        pw = f.readline().strip()
    if len(pw) < 24:
        print('refusing: password shorter than 24 characters (use a long random one)', file=sys.stderr)
        return 1
    print(f"ALTER ROLE {role} PASSWORD '{scram_verifier(pw)}';")
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
