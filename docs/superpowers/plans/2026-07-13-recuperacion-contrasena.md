# Password Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar flujo de recuperación de contraseña por email usando Resend, con token UUID de un solo uso con expiración de 1 hora.

**Architecture:** Nueva tabla `password_reset_tokens` en PostgreSQL almacena tokens generados con `secrets.token_urlsafe(32)`. El backend extiende `auth_service.py` con dos funciones, agrega `email_service.py` para llamadas a Resend, dos schemas y dos endpoints bajo `/api/v1/auth/`. El frontend agrega `ForgotPasswordPage` y `ResetPasswordPage`, más un link "¿Olvidaste tu contraseña?" en Login.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, Resend Python SDK, React 18 + Vite, React Router v6, Framer Motion, Tailwind CSS.

## Global Constraints

- Nunca commitear `.env` con valores reales — solo `.env.prod.example` con placeholders
- El token inválido/expirado devuelve `400` con `"Token inválido o expirado."`
- Email inexistente devuelve `200` con mensaje genérico — no revelar si el email existe
- Contraseña mínima 8 caracteres (igual que en registro)
- El frontend no lleva `ProtectedRoute` en `/forgot-password` ni `/reset-password`
- Sender: `noreply@socialmind.it.com`

---

### Task 1: Backend — Dependencias, Config y .env.prod.example

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/app/config.py`
- Modify: `.env.prod.example`

**Interfaces:**
- Produces: `settings.resend_api_key: str`, `settings.frontend_url: str` disponibles en toda la app

- [ ] **Step 1: Agregar dependencias a requirements.txt**

Agregar al final de `backend/requirements.txt`:
```
resend>=2.0.0
email-validator>=2.1.0
```

- [ ] **Step 2: Agregar campos a config.py**

`backend/app/config.py` debe quedar así:
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:3000"
    app_env: str = "development"
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    resend_api_key: str = ""
    frontend_url: str = "https://socialmind.it.com"

    class Config:
        env_file = ".env"

settings = Settings()
```

- [ ] **Step 3: Agregar variables de entorno al ejemplo**

Agregar al final de `.env.prod.example`:
```
# Resend — Recuperación de contraseña
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
FRONTEND_URL=https://socialmind.it.com
```

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt backend/app/config.py .env.prod.example
git commit -m "feat: add resend and email-validator deps, add config fields"
```

---

### Task 2: DB Model + Alembic Migration

**Files:**
- Create: `backend/app/models/password_reset_token.py`
- Create: `backend/alembic/versions/e1f2a3b4c5d6_add_password_reset_tokens.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Produces:
  - `PasswordResetToken` (SQLAlchemy model, tabla `password_reset_tokens`)
  - Campos: `id: int`, `user_id: int`, `token: str(64)`, `expires_at: datetime`, `created_at: datetime`

- [ ] **Step 1: Escribir test que verifica que la tabla se crea correctamente**

Crear `backend/tests/test_password_reset.py`:
```python
from datetime import datetime, timezone, timedelta
import secrets
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User, UserRole
from app.core.security import hash_password


def _make_user(db):
    user = User(
        email="test@example.com",
        hashed_password=hash_password("Password123!"),
        full_name="Test User",
        role=UserRole.parent,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_password_reset_token_model(db):
    user = _make_user(db)
    token = PasswordResetToken(
        user_id=user.id,
        token=secrets.token_urlsafe(32),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(token)
    db.commit()
    db.refresh(token)

    assert token.id is not None
    assert token.user_id == user.id
    assert token.created_at is not None
```

- [ ] **Step 2: Ejecutar test — debe FALLAR**

```bash
cd backend
pytest tests/test_password_reset.py::test_password_reset_token_model -v
```
Esperado: `FAILED` con `ImportError` o `OperationalError` (tabla no existe)

- [ ] **Step 3: Crear el modelo**

Crear `backend/app/models/password_reset_token.py`:
```python
from datetime import datetime, timezone
from sqlalchemy import Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    user: Mapped["User"] = relationship("User")
```

- [ ] **Step 4: Registrar el modelo en `models/__init__.py`**

`backend/app/models/__init__.py` debe quedar así:
```python
from app.models.user import User, UserRole
from app.models.child_profile import ChildProfile
from app.models.emotion_log import EmotionLog
from app.models.scenario_completion import ScenarioCompletion
from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage
from app.models.calm_session import CalmSession
from app.models.specialist_note import SpecialistNote
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.password_reset_token import PasswordResetToken

__all__ = [
    "User", "UserRole", "ChildProfile",
    "EmotionLog", "ScenarioCompletion",
    "ChatConversation", "ChatMessage",
    "CalmSession", "SpecialistNote",
    "Document", "DocumentChunk",
    "PasswordResetToken",
]
```

- [ ] **Step 5: Importar el modelo en `main.py`**

Agregar en `backend/app/main.py`, junto a los otros imports de modelos:
```python
import app.models.password_reset_token
```

- [ ] **Step 6: Ejecutar test — debe PASAR**

```bash
cd backend
pytest tests/test_password_reset.py::test_password_reset_token_model -v
```
Esperado: `PASSED`

- [ ] **Step 7: Crear migración Alembic**

Crear `backend/alembic/versions/e1f2a3b4c5d6_add_password_reset_tokens.py`:
```python
"""add_password_reset_tokens

Revision ID: e1f2a3b4c5d6
Revises: d9e0f1a2b3c4
Create Date: 2026-07-13

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'd9e0f1a2b3c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'password_reset_tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(64), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_password_reset_tokens_id'), 'password_reset_tokens', ['id'], unique=False)
    op.create_index(op.f('ix_password_reset_tokens_token'), 'password_reset_tokens', ['token'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_password_reset_tokens_token'), table_name='password_reset_tokens')
    op.drop_index(op.f('ix_password_reset_tokens_id'), table_name='password_reset_tokens')
    op.drop_table('password_reset_tokens')
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/models/password_reset_token.py \
        backend/alembic/versions/e1f2a3b4c5d6_add_password_reset_tokens.py \
        backend/app/models/__init__.py \
        backend/app/main.py \
        backend/tests/test_password_reset.py
git commit -m "feat: add PasswordResetToken model and Alembic migration"
```

---

### Task 3: Email Service

**Files:**
- Create: `backend/app/services/email_service.py`
- Modify: `backend/tests/test_password_reset.py` (agregar tests)

**Interfaces:**
- Produces: `send_password_reset_email(to_email: str, full_name: str, token: str) -> None`

- [ ] **Step 1: Escribir test para email service**

Agregar en `backend/tests/test_password_reset.py`:
```python
from unittest.mock import patch, MagicMock
from app.services.email_service import send_password_reset_email


def test_send_password_reset_email_calls_resend():
    with patch("app.services.email_service.resend.Emails.send") as mock_send:
        mock_send.return_value = MagicMock()
        send_password_reset_email(
            to_email="user@example.com",
            full_name="Ana García",
            token="abc123token",
        )
        mock_send.assert_called_once()
        call_args = mock_send.call_args[0][0]
        assert call_args["to"] == "user@example.com"
        assert "abc123token" in call_args["html"]
        assert "Ana García" in call_args["html"]
        assert call_args["from"] == "noreply@socialmind.it.com"
```

- [ ] **Step 2: Ejecutar test — debe FALLAR**

```bash
cd backend
pytest tests/test_password_reset.py::test_send_password_reset_email_calls_resend -v
```
Esperado: `FAILED` con `ImportError`

- [ ] **Step 3: Implementar email service**

Crear `backend/app/services/email_service.py`:
```python
import resend
from app.config import settings


def send_password_reset_email(to_email: str, full_name: str, token: str) -> None:
    resend.api_key = settings.resend_api_key
    reset_url = f"{settings.frontend_url}/reset-password?token={token}"
    resend.Emails.send({
        "from": "noreply@socialmind.it.com",
        "to": to_email,
        "subject": "Recupera tu contraseña de SocialMind",
        "html": f"""
        <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
          <h2>Hola, {full_name}</h2>
          <p>Recibimos una solicitud para restablecer tu contraseña en SocialMind.</p>
          <p>
            <a href="{reset_url}"
               style="display:inline-block;padding:12px 24px;background:#5b8dd9;
                      color:white;border-radius:8px;text-decoration:none;font-weight:bold;">
              Restablecer contraseña
            </a>
          </p>
          <p>Este enlace expira en <strong>1 hora</strong>.</p>
          <p>Si no solicitaste este cambio, ignora este mensaje. Tu contraseña no cambiará.</p>
        </div>
        """,
    })
```

- [ ] **Step 4: Ejecutar test — debe PASAR**

```bash
cd backend
pytest tests/test_password_reset.py::test_send_password_reset_email_calls_resend -v
```
Esperado: `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/email_service.py backend/tests/test_password_reset.py
git commit -m "feat: add email_service for password reset via Resend"
```

---

### Task 4: Auth Service — Funciones de Reset

**Files:**
- Modify: `backend/app/services/auth_service.py`
- Modify: `backend/tests/test_password_reset.py` (agregar tests)

**Interfaces:**
- Consumes: `send_password_reset_email(to_email, full_name, token)` de Task 3
- Produces:
  - `request_password_reset(db: Session, email: str) -> None`
  - `reset_password(db: Session, token: str, new_password: str) -> None` (lanza `HTTPException(400)` si token inválido/expirado)

- [ ] **Step 1: Escribir tests de servicio**

Agregar en `backend/tests/test_password_reset.py`:
```python
from datetime import datetime, timezone, timedelta
from unittest.mock import patch
import pytest
from fastapi import HTTPException
from app.services.auth_service import request_password_reset, reset_password
from app.models.password_reset_token import PasswordResetToken


def test_request_password_reset_creates_token(db):
    user = _make_user(db)
    with patch("app.services.auth_service.send_password_reset_email") as mock_email:
        request_password_reset(db, user.email)
        mock_email.assert_called_once()
        assert mock_email.call_args[1]["to_email"] == user.email

    token_row = db.query(PasswordResetToken).filter_by(user_id=user.id).first()
    assert token_row is not None
    assert len(token_row.token) > 10


def test_request_password_reset_unknown_email_is_silent(db):
    with patch("app.services.auth_service.send_password_reset_email") as mock_email:
        request_password_reset(db, "noexiste@example.com")
        mock_email.assert_not_called()


def test_request_password_reset_deletes_previous_tokens(db):
    user = _make_user(db)
    old_token = PasswordResetToken(
        user_id=user.id,
        token="old_token_value",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(old_token)
    db.commit()

    with patch("app.services.auth_service.send_password_reset_email"):
        request_password_reset(db, user.email)

    count = db.query(PasswordResetToken).filter_by(user_id=user.id).count()
    assert count == 1
    remaining = db.query(PasswordResetToken).filter_by(user_id=user.id).first()
    assert remaining.token != "old_token_value"


def test_reset_password_valid_token(db):
    user = _make_user(db)
    token_value = secrets.token_urlsafe(32)
    reset_token = PasswordResetToken(
        user_id=user.id,
        token=token_value,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(reset_token)
    db.commit()

    reset_password(db, token_value, "NuevaPassword123!")

    db.refresh(user)
    from app.core.security import verify_password
    assert verify_password("NuevaPassword123!", user.hashed_password)
    assert db.query(PasswordResetToken).filter_by(token=token_value).first() is None


def test_reset_password_invalid_token(db):
    with pytest.raises(HTTPException) as exc_info:
        reset_password(db, "token_inventado", "NuevaPassword123!")
    assert exc_info.value.status_code == 400
    assert "inválido" in exc_info.value.detail


def test_reset_password_expired_token(db):
    user = _make_user(db)
    token_value = secrets.token_urlsafe(32)
    expired_token = PasswordResetToken(
        user_id=user.id,
        token=token_value,
        expires_at=datetime.now(timezone.utc) - timedelta(hours=2),
    )
    db.add(expired_token)
    db.commit()

    with pytest.raises(HTTPException) as exc_info:
        reset_password(db, token_value, "NuevaPassword123!")
    assert exc_info.value.status_code == 400
```

- [ ] **Step 2: Ejecutar tests — deben FALLAR**

```bash
cd backend
pytest tests/test_password_reset.py -k "request_password_reset or reset_password" -v
```
Esperado: `FAILED` con `ImportError` (funciones no existen todavía)

- [ ] **Step 3: Implementar funciones en auth_service.py**

Agregar al final de `backend/app/services/auth_service.py`:
```python
import secrets
from datetime import datetime, timezone, timedelta
from app.models.password_reset_token import PasswordResetToken
from app.services.email_service import send_password_reset_email


def request_password_reset(db: Session, email: str) -> None:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).delete()
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    db.add(PasswordResetToken(user_id=user.id, token=token, expires_at=expires_at))
    db.commit()
    send_password_reset_email(to_email=user.email, full_name=user.full_name, token=token)


def reset_password(db: Session, token: str, new_password: str) -> None:
    reset = db.query(PasswordResetToken).filter(PasswordResetToken.token == token).first()
    if not reset or reset.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token inválido o expirado.")
    user = db.query(User).filter(User.id == reset.user_id).first()
    user.hashed_password = hash_password(new_password)
    db.delete(reset)
    db.commit()
```

El bloque de imports al inicio del archivo ya contiene `Session`, `HTTPException`, `User`, `hash_password` — solo se agregan los nuevos imports que falten:
```python
import secrets
from datetime import datetime, timezone, timedelta
from app.models.password_reset_token import PasswordResetToken
from app.services.email_service import send_password_reset_email
```

- [ ] **Step 4: Ejecutar tests — deben PASAR**

```bash
cd backend
pytest tests/test_password_reset.py -k "request_password_reset or reset_password" -v
```
Esperado: todos `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/auth_service.py backend/tests/test_password_reset.py
git commit -m "feat: add request_password_reset and reset_password service functions"
```

---

### Task 5: Schemas + Endpoints + Tests de Integración

**Files:**
- Modify: `backend/app/schemas/auth.py`
- Modify: `backend/app/routers/auth.py`
- Modify: `backend/tests/test_password_reset.py` (agregar tests de endpoints)

**Interfaces:**
- Consumes: `request_password_reset(db, email)` y `reset_password(db, token, new_password)` de Task 4
- Produces:
  - `POST /api/v1/auth/forgot-password` → `200 {"message": "..."}`
  - `POST /api/v1/auth/reset-password` → `200 {"message": "..."}` | `400`

- [ ] **Step 1: Escribir tests de endpoints**

Agregar en `backend/tests/test_password_reset.py`:
```python
def test_forgot_password_known_email_returns_200(client, db):
    client.post("/api/v1/auth/register", json={
        "email": "padre@example.com",
        "password": "Password123!",
        "full_name": "Juan García",
        "role": "parent",
    })
    with patch("app.routers.auth.request_password_reset") as mock_req:
        response = client.post("/api/v1/auth/forgot-password", json={"email": "padre@example.com"})
    assert response.status_code == 200
    assert "recibirás un enlace" in response.json()["message"]
    mock_req.assert_called_once()


def test_forgot_password_unknown_email_also_returns_200(client):
    with patch("app.routers.auth.request_password_reset"):
        response = client.post("/api/v1/auth/forgot-password", json={"email": "noexiste@x.com"})
    assert response.status_code == 200
    assert "recibirás un enlace" in response.json()["message"]


def test_forgot_password_invalid_email_returns_422(client):
    response = client.post("/api/v1/auth/forgot-password", json={"email": "no-es-un-email"})
    assert response.status_code == 422


def test_reset_password_valid_flow(client, db):
    client.post("/api/v1/auth/register", json={
        "email": "padre@example.com",
        "password": "Password123!",
        "full_name": "Juan García",
        "role": "parent",
    })
    from app.models.user import User
    from app.models.password_reset_token import PasswordResetToken
    user = db.query(User).filter_by(email="padre@example.com").first()
    token_value = secrets.token_urlsafe(32)
    reset_tok = PasswordResetToken(
        user_id=user.id,
        token=token_value,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(reset_tok)
    db.commit()

    response = client.post("/api/v1/auth/reset-password", json={
        "token": token_value,
        "new_password": "NuevaPassword456!",
    })
    assert response.status_code == 200
    assert "actualizada" in response.json()["message"]

    login = client.post("/api/v1/auth/login", json={
        "email": "padre@example.com",
        "password": "NuevaPassword456!",
    })
    assert login.status_code == 200


def test_reset_password_invalid_token_returns_400(client):
    response = client.post("/api/v1/auth/reset-password", json={
        "token": "token_inventado_xyz",
        "new_password": "NuevaPassword456!",
    })
    assert response.status_code == 400
    assert "inválido" in response.json()["detail"]


def test_reset_password_short_password_returns_422(client):
    response = client.post("/api/v1/auth/reset-password", json={
        "token": "cualquier_token",
        "new_password": "corta",
    })
    assert response.status_code == 422
```

- [ ] **Step 2: Ejecutar tests — deben FALLAR**

```bash
cd backend
pytest tests/test_password_reset.py -k "forgot_password or reset_password" -v
```
Esperado: `FAILED` con 404 (endpoints no existen todavía)

- [ ] **Step 3: Agregar schemas a auth.py**

Agregar al final de `backend/app/schemas/auth.py`:
```python
from pydantic import Field

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ForgotPasswordResponse(BaseModel):
    message: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

class ResetPasswordResponse(BaseModel):
    message: str
```

- [ ] **Step 4: Agregar endpoints al router**

Agregar en `backend/app/routers/auth.py`:

Primero actualizar el import de schemas:
```python
from app.schemas.auth import (
    LoginRequest, TokenResponse, UserResponse, RegisterRequest,
    ForgotPasswordRequest, ForgotPasswordResponse,
    ResetPasswordRequest, ResetPasswordResponse,
)
```

Agregar import de los servicios nuevos:
```python
from app.services.auth_service import register_user, authenticate_user, request_password_reset, reset_password
```

Agregar los endpoints al final del archivo:
```python
@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    request_password_reset(db, data.email)
    return {"message": "Si ese correo está registrado, recibirás un enlace en los próximos minutos."}


@router.post("/reset-password", response_model=ResetPasswordResponse)
def reset_password_endpoint(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    reset_password(db, data.token, data.new_password)
    return {"message": "Contraseña actualizada correctamente."}
```

- [ ] **Step 5: Ejecutar todos los tests de password reset**

```bash
cd backend
pytest tests/test_password_reset.py -v
```
Esperado: todos `PASSED`

- [ ] **Step 6: Ejecutar suite completa para verificar que no hay regresiones**

```bash
cd backend
pytest tests/ -v
```
Esperado: todos `PASSED`

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/auth.py backend/app/routers/auth.py backend/tests/test_password_reset.py
git commit -m "feat: add forgot-password and reset-password endpoints"
```

---

### Task 6: Frontend — API Client + ForgotPasswordPage

**Files:**
- Modify: `frontend/src/services/api.js`
- Create: `frontend/src/pages/ForgotPasswordPage.jsx`

**Interfaces:**
- Consumes: `POST /api/v1/auth/forgot-password` y `POST /api/v1/auth/reset-password`
- Produces:
  - `authApi.forgotPassword(email)` → axios promise
  - `authApi.resetPassword(token, new_password)` → axios promise
  - `<ForgotPasswordPage />` — página pública con formulario de email

- [ ] **Step 1: Extender authApi en api.js**

En `frontend/src/services/api.js`, reemplazar el bloque `authApi` existente:
```js
export const authApi = {
  register:       (data)                 => api.post('/auth/register', data),
  login:          (data)                 => api.post('/auth/login', data),
  getMe:          ()                     => api.get('/auth/me'),
  forgotPassword: (email)                => api.post('/auth/forgot-password', { email }),
  resetPassword:  (token, new_password)  => api.post('/auth/reset-password', { token, new_password }),
}
```

- [ ] **Step 2: Crear ForgotPasswordPage**

Crear `frontend/src/pages/ForgotPasswordPage.jsx`:
```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { LumiCharacter } from '../components/lumi/LumiCharacter'
import { authApi } from '../services/api'

export function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch {
      setError('Ocurrió un error. Por favor intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper className="items-center justify-center px-6 py-12">
      <div className="max-w-md w-full flex flex-col items-center gap-6">
        <LumiCharacter state="idle" size={100} />

        <Card animate className="w-full">
          {sent ? (
            <div className="flex flex-col gap-4 text-center">
              <h1 className="text-2xl font-extrabold text-primary-700">Revisa tu correo</h1>
              <p className="text-text-secondary text-sm">
                Si ese correo está registrado, recibirás un enlace en los próximos minutos.
                Revisa también tu carpeta de spam.
              </p>
              <Link to="/login" className="text-primary-600 text-sm font-semibold hover:underline">
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <h1 className="text-2xl font-extrabold text-primary-700">¿Olvidaste tu contraseña?</h1>
                <p className="text-sm text-text-secondary mt-1">
                  Escribe tu correo y te enviaremos un enlace para restablecerla.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  label="Correo electrónico"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />

                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-accent-coral text-xs text-center"
                    role="alert"
                  >
                    {error}
                  </motion.p>
                )}

                <Button type="submit" disabled={loading || !email.trim()} className="w-full mt-2">
                  {loading ? 'Enviando...' : 'Enviar instrucciones'}
                </Button>
              </form>

              <p className="text-center text-sm text-text-secondary">
                <Link to="/login" className="text-primary-600 font-semibold hover:underline">
                  Volver al inicio de sesión
                </Link>
              </p>
            </div>
          )}
        </Card>
      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/api.js frontend/src/pages/ForgotPasswordPage.jsx
git commit -m "feat: add ForgotPasswordPage and authApi.forgotPassword/resetPassword"
```

---

### Task 7: Frontend — ResetPasswordPage

**Files:**
- Create: `frontend/src/pages/ResetPasswordPage.jsx`

**Interfaces:**
- Consumes: `authApi.resetPassword(token, new_password)` de Task 6
- Produces: `<ResetPasswordPage />` — página pública, lee `?token=` de URL, muestra formulario de nueva contraseña

- [ ] **Step 1: Crear ResetPasswordPage**

Crear `frontend/src/pages/ResetPasswordPage.jsx`:
```jsx
import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { LumiCharacter } from '../components/lumi/LumiCharacter'
import { authApi } from '../services/api'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const token          = searchParams.get('token')

  const [form, setForm]     = useState({ password: '', confirm: '' })
  const [success, setSuccess] = useState(false)
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  if (!token) {
    navigate('/forgot-password', { replace: true })
    return null
  }

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    try {
      await authApi.resetPassword(token, form.password)
      setSuccess(true)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (err.response?.status === 400) {
        setError(
          typeof detail === 'string' ? detail : 'El enlace no es válido o ha expirado.'
        )
      } else {
        setError('Ocurrió un error. Por favor intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper className="items-center justify-center px-6 py-12">
      <div className="max-w-md w-full flex flex-col items-center gap-6">
        <LumiCharacter state="happy" size={100} />

        <Card animate className="w-full">
          {success ? (
            <div className="flex flex-col gap-4 text-center">
              <h1 className="text-2xl font-extrabold text-primary-700">¡Contraseña actualizada!</h1>
              <p className="text-text-secondary text-sm">
                Tu contraseña fue restablecida correctamente. Ya puedes iniciar sesión.
              </p>
              <Link to="/login" className="text-primary-600 text-sm font-semibold hover:underline">
                Ir al inicio de sesión
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <h1 className="text-2xl font-extrabold text-primary-700">Nueva contraseña</h1>
                <p className="text-sm text-text-secondary mt-1">
                  Escribe tu nueva contraseña (mínimo 8 caracteres).
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  label="Nueva contraseña"
                  placeholder="Mínimo 8 caracteres"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                />
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  label="Confirmar contraseña"
                  placeholder="Repite tu nueva contraseña"
                  value={form.confirm}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                />

                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-accent-coral text-xs text-center"
                    role="alert"
                  >
                    {error}
                  </motion.p>
                )}

                <Button
                  type="submit"
                  disabled={loading || !form.password || !form.confirm}
                  className="w-full mt-2"
                >
                  {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
                </Button>
              </form>

              <p className="text-center text-sm text-text-secondary">
                <Link to="/forgot-password" className="text-primary-600 font-semibold hover:underline">
                  Solicitar un nuevo enlace
                </Link>
              </p>
            </div>
          )}
        </Card>
      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/ResetPasswordPage.jsx
git commit -m "feat: add ResetPasswordPage with token validation and confirm password"
```

---

### Task 8: Frontend — Login Link + Router + Verificación Final

**Files:**
- Modify: `frontend/src/pages/Login.jsx`
- Modify: `frontend/src/router/index.jsx`

**Interfaces:**
- Consumes: `<ForgotPasswordPage />` de Task 6, `<ResetPasswordPage />` de Task 7

- [ ] **Step 1: Agregar link en Login.jsx**

En `frontend/src/pages/Login.jsx`, dentro del `<form>`, agregar el link debajo del botón "Entrar":

Reemplazar:
```jsx
              <Button type="submit" disabled={loading} className="w-full mt-2">
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
```

Por:
```jsx
              <Button type="submit" disabled={loading} className="w-full mt-2">
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
              <div className="text-center">
                <Link to="/forgot-password" className="text-sm text-primary-600 hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </form>
```

- [ ] **Step 2: Agregar rutas en router/index.jsx**

En `frontend/src/router/index.jsx`, agregar imports al inicio del bloque de imports de páginas:
```jsx
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage'
import { ResetPasswordPage }  from '../pages/ResetPasswordPage'
```

Agregar las rutas públicas en el array del router, junto a `/login` y `/registro`:
```jsx
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password',  element: <ResetPasswordPage /> },
```

- [ ] **Step 3: Verificar build sin errores**

```bash
cd frontend
npm run build
```
Esperado: salida sin errores, bundle generado en `dist/`

- [ ] **Step 4: Ejecutar suite de tests del backend una vez más**

```bash
cd backend
pytest tests/ -v
```
Esperado: todos `PASSED`

- [ ] **Step 5: Commit final**

```bash
git add frontend/src/pages/Login.jsx frontend/src/router/index.jsx
git commit -m "feat: wire forgot/reset password pages into router and login link"
```

---

## Despliegue en VPS

Después de todos los commits, para llevar al servidor de producción:

```bash
# 1. En el VPS, agregar las variables de entorno al .env
echo "RESEND_API_KEY=re_xxx..." >> /root/socialmind/.env
echo "FRONTEND_URL=https://socialmind.it.com" >> /root/socialmind/.env

# 2. Rebuildar y reiniciar backend (aplica migración Alembic automáticamente si está configurado)
docker compose -f docker-compose.prod.yml up -d --build backend

# 3. Ejecutar migración Alembic
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# 4. Rebuildar frontend
docker compose -f docker-compose.prod.yml up -d --build nginx
```

> **Nota:** El `RESEND_API_KEY` real se obtiene en https://resend.com/api-keys. El dominio `socialmind.it.com` debe estar verificado en Resend antes de poder enviar desde `noreply@socialmind.it.com`.
