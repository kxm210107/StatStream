"""FastAPI dependency for verifying Supabase JWTs."""
from dataclasses import dataclass
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, ExpiredSignatureError
from jose.backends import ECKey

_bearer = HTTPBearer(auto_error=False)

JWT_ALGORITHM = "ES256"
JWT_AUDIENCE = "authenticated"

# EC public key from https://dlzupeheohnylpqkisbw.supabase.co/auth/v1/.well-known/jwks.json
_SUPABASE_JWK = {
    "kty": "EC",
    "crv": "P-256",
    "use": "sig",
    "alg": "ES256",
    "kid": "da741f3b-87ab-420e-b78f-b9060f5b134e",
    "x": "VvRZ6hcpac9qoKuKQEsLmDF76y4d_PZdTVxYYaMnVqU",
    "y": "O1wUUKtg72AIYJvzcjnZ2CmzSJ8dGwYg2hs_R3M-7m4",
}

_PUBLIC_KEY = ECKey(_SUPABASE_JWK, algorithm=JWT_ALGORITHM)


@dataclass
class AuthIdentity:
    auth_user_id: str
    email: str


def _verify_token(token: str) -> AuthIdentity:
    """Verify a Supabase JWT string and return the auth identity. Used directly in tests."""
    try:
        payload = jwt.decode(
            token,
            _PUBLIC_KEY,
            algorithms=[JWT_ALGORITHM],
            audience=JWT_AUDIENCE,
            options={"verify_aud": True},
        )
        auth_user_id = payload.get("sub")
        email = payload.get("email", "")
        if not auth_user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
        return AuthIdentity(auth_user_id=auth_user_id, email=email)
    except ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except JWTError as e:
        print(f"[auth] JWT decode failed: {e} | token_prefix={token[:20] if token else None}", flush=True)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> AuthIdentity:
    """FastAPI dependency — extracts Bearer token and verifies it."""
    print(f"[auth] get_current_user called, credentials={'present' if credentials else 'None'}", flush=True)
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authenticated")
    return _verify_token(credentials.credentials)
