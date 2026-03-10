"""FastAPI dependency for verifying Supabase JWTs."""
import os
from dataclasses import dataclass
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, ExpiredSignatureError

_bearer = HTTPBearer(auto_error=False)

JWT_ALGORITHM = "HS256"
JWT_AUDIENCE = "authenticated"


@dataclass
class AuthIdentity:
    auth_user_id: str
    email: str


def _verify_token(token: str) -> AuthIdentity:
    """Verify a Supabase JWT string and return the auth identity. Used directly in tests."""
    jwt_secret = os.environ.get("SUPABASE_JWT_SECRET", "")
    try:
        payload = jwt.decode(
            token,
            jwt_secret,
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
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> AuthIdentity:
    """FastAPI dependency — extracts Bearer token and verifies it."""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authenticated")
    return _verify_token(credentials.credentials)
