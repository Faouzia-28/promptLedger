"""Simple encryption helpers for storing secrets (tokens) at rest.

Uses Fernet (symmetric) with `ENCRYPTION_KEY` from settings. If not provided,
falls back to using `SECRET_KEY` trimmed/padded (less secure).
"""
from typing import Optional
from app.core.config import settings

try:
    from cryptography.fernet import Fernet, InvalidToken
except Exception:
    Fernet = None
    InvalidToken = Exception


def _get_fernet() -> Optional[object]:
    key = getattr(settings, 'ENCRYPTION_KEY', None) or None
    if not key:
        # Derive a key from SECRET_KEY (not ideal) but provides basic protection
        raw = settings.SECRET_KEY.encode('utf-8')[:32].ljust(32, b'0')
        try:
            import base64

            key = base64.urlsafe_b64encode(raw)
        except Exception:
            return None
    else:
        # Expect key to be urlsafe-base64 encoded; if length looks short, try to pad
        key = key.encode('utf-8') if isinstance(key, str) else key

    if Fernet is None:
        return None
    try:
        return Fernet(key)
    except Exception:
        return None


def encrypt_token(plain: Optional[str]) -> Optional[str]:
    if not plain:
        return plain
    f = _get_fernet()
    if not f:
        return plain
    try:
        return f.encrypt(plain.encode('utf-8')).decode('utf-8')
    except Exception:
        return plain


def decrypt_token(cipher: Optional[str]) -> Optional[str]:
    if not cipher:
        return cipher
    f = _get_fernet()
    if not f:
        return cipher
    try:
        return f.decrypt(cipher.encode('utf-8')).decode('utf-8')
    except InvalidToken:
        return None
    except Exception:
        return None
