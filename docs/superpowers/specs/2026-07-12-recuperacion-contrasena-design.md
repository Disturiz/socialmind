# Spec: Recuperación de Contraseña

**Fecha:** 2026-07-12
**Estado:** Aprobado
**Módulo:** Auth

---

## Objetivo

Permitir que usuarios (padre, especialista) recuperen el acceso a su cuenta cuando olvidan su contraseña, mediante un enlace enviado por email con validez de 1 hora.

---

## Alcance

- Tabla `password_reset_tokens` en PostgreSQL
- Migración Alembic
- Servicio de email con Resend SDK
- 2 endpoints nuevos bajo `/api/v1/auth/`
- 2 páginas nuevas en el frontend
- Link "¿Olvidaste tu contraseña?" en `/login`

---

## Backend

### Modelo

```python
# backend/app/models/password_reset_token.py
class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user: Mapped["User"] = relationship("User")
```

### Migración Alembic

- Archivo: `backend/alembic/versions/e1f2a3b4c5d6_add_password_reset_tokens.py`
- `down_revision`: apuntará al head actual del branch
- Crea tabla `password_reset_tokens` con FK a `users.id`, índice en `token`

### Servicio de email

**`backend/app/services/email_service.py`**

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

### Servicio de auth (extensión)

**`backend/app/services/auth_service.py`** — agregar:

```python
def request_password_reset(db: Session, email: str) -> None:
    """Crea token y envía email. Silencioso si el email no existe."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return
    # Borrar tokens anteriores del usuario
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).delete()
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    db.add(PasswordResetToken(user_id=user.id, token=token, expires_at=expires_at))
    db.commit()
    send_password_reset_email(user.email, user.full_name, token)


def reset_password(db: Session, token: str, new_password: str) -> None:
    """Valida token, actualiza contraseña, elimina token. 400 si inválido/expirado."""
    reset = db.query(PasswordResetToken).filter(PasswordResetToken.token == token).first()
    if not reset or reset.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token inválido o expirado.")
    user = db.query(User).filter(User.id == reset.user_id).first()
    user.hashed_password = hash_password(new_password)
    db.delete(reset)
    db.commit()
```

### Schemas

```python
# backend/app/schemas/auth.py — agregar:

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

### Endpoints

**`backend/app/routers/auth.py`** — agregar:

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/forgot-password` | No | Recibe email, envía link si existe. Siempre 200. |
| `POST` | `/reset-password` | No | Valida token, actualiza contraseña. 400 si inválido. |

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

### Configuración

**`backend/app/config.py`** — agregar:

```python
resend_api_key: str = ""
frontend_url: str = "https://socialmind.it.com"
```

**`.env.prod.example`** — agregar:
```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
FRONTEND_URL=https://socialmind.it.com
```

### Dependencias

```
# backend/requirements.txt — agregar:
resend>=2.0.0
email-validator>=2.1.0
```

---

## Frontend

### Página: Olvidé mi contraseña

**`frontend/src/pages/ForgotPasswordPage.jsx`**

Ruta: `/forgot-password` (pública, sin ProtectedRoute)

- Campo email + botón "Enviar instrucciones"
- Tras respuesta exitosa (200): reemplaza el formulario con mensaje:
  *"Si ese correo está registrado, recibirás un enlace en los próximos minutos. Revisa también tu carpeta de spam."*
- Error de red: mensaje rojo inline

### Página: Restablecer contraseña

**`frontend/src/pages/ResetPasswordPage.jsx`**

Ruta: `/reset-password` (pública, sin ProtectedRoute)

- Lee `token` de `useSearchParams()`
- Si no hay token en URL → redirige a `/forgot-password`
- Formulario: campo "Nueva contraseña" + campo "Confirmar contraseña" (mínimo 8 caracteres, deben coincidir — validación en frontend antes de enviar)
- Éxito: mensaje "Contraseña actualizada. Puedes iniciar sesión." + link a `/login`
- Error 400 (token inválido/expirado): mensaje rojo + link a `/forgot-password` para solicitar nuevo enlace

### Modificación: Login

**`frontend/src/pages/Login.jsx`** — agregar bajo el botón Entrar:

```jsx
<Link to="/forgot-password" className="text-sm text-primary-600 hover:underline">
  ¿Olvidaste tu contraseña?
</Link>
```

### API client

**`frontend/src/services/api.js`** — agregar:

```js
export const authApi = {
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, new_password) => api.post('/auth/reset-password', { token, new_password }),
}
```

### Router

**`frontend/src/router/index.jsx`** — agregar rutas públicas:

```jsx
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password" element={<ResetPasswordPage />} />
```

---

## Seguridad

| Consideración | Decisión |
|---|---|
| Email no encontrado | Respuesta idéntica al caso exitoso — no revela si el email existe |
| Token de un solo uso | Se elimina inmediatamente al ser usado |
| Tokens anteriores | Se borran al solicitar uno nuevo (1 token activo por usuario) |
| Expiración | 1 hora desde creación |
| Contraseña mínima | 8 caracteres (igual que en registro) |
| Token en URL | `secrets.token_urlsafe(32)` — 256 bits de entropía, no predecible |

---

## Errores

| Caso | Respuesta |
|------|-----------|
| Email no existe | 200 (mensaje genérico) |
| Token inválido | 400 `"Token inválido o expirado."` |
| Token expirado | 400 `"Token inválido o expirado."` |
| Contraseñas no coinciden | Validación frontend, no llega al backend |
| `new_password` < 8 chars | 422 Pydantic |
| Resend falla | 503 (el servicio lanza excepción) |

---

## Lo que queda fuera de este spec

- Límite de intentos de solicitud por IP (rate limiting)
- Notificación por email al cambiar contraseña exitosamente
- Cambio de contraseña desde dentro de la app (usuario autenticado)
