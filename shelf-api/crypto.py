import os
import base64
import hashlib
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken


def _derive_key() -> bytes:
    """Return a Fernet-compatible key.

    Prefers `TOKEN_ENCRYPTION_KEY` (a urlsafe base64 32-byte key, as produced by
    `Fernet.generate_key()`). If only `JWT_SECRET` is set — common in dev — a
    key is derived deterministically from it so tokens written in dev remain
    decryptable across restarts. Production must set TOKEN_ENCRYPTION_KEY.
    """
    key = os.environ.get("TOKEN_ENCRYPTION_KEY")
    if key:
        return key.encode() if isinstance(key, str) else key
    seed = os.environ.get("JWT_SECRET", "change-me-in-production").encode()
    digest = hashlib.sha256(seed).digest()
    return base64.urlsafe_b64encode(digest)


_fernet = Fernet(_derive_key())


def encrypt(plain: str) -> str:
    return _fernet.encrypt(plain.encode()).decode()


def decrypt(token: str) -> Optional[str]:
    try:
        return _fernet.decrypt(token.encode()).decode()
    except (InvalidToken, ValueError, TypeError):
        return None
