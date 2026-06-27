# SocialMind Etapa 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la base completa de SocialMind — scaffolding del proyecto, entorno Docker, backend FastAPI con autenticación JWT y roles, y frontend React con el sistema de diseño accesible y páginas de auth.

**Architecture:** Monorepo con `frontend/` y `backend/` separados, orquestados por Docker Compose. El backend expone una API REST (FastAPI + PostgreSQL + JWT). El frontend es una SPA React (Vite + Tailwind + Framer Motion) que se comunica con el backend via Axios. Auth usa JWT con roles: `admin`, `parent`, `specialist`. Los perfiles de niños los crean los padres, no son usuarios directos del sistema auth.

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3, Framer Motion 11, React Router 6, Axios, FastAPI 0.111, SQLAlchemy 2, PostgreSQL 15, Alembic, python-jose, passlib[bcrypt], Docker Compose, pytest, httpx, Vitest, Testing Library

## Global Constraints

- Todo el texto visible al usuario: **solo en español**
- Sin lenguaje clínico, diagnóstico ni médico en ningún lugar del código o UI
- Paleta de colores: usar exclusivamente las variables definidas en Task 5 (no colores Tailwind arbitrarios)
- Tamaño mínimo de fuente: 16px (accesibilidad cognitiva)
- Tamaño mínimo de botones: 44×44px touch target
- Personaje guía: **Lumi** (búho amigable, de "luz", género neutro)
- API keys y secretos: siempre en `.env`, nunca en el código
- Los niños NO se registran directamente; los padres crean sus perfiles
- Todos los comandos se ejecutan desde la raíz del proyecto (`C:\Users\distu\socialmind`) salvo que se indique lo contrario

---

## Mapa de archivos

```
socialmind/
├── .gitignore
├── .gitattributes
├── .env.example
├── .env                          ← crear manualmente, no commitear
├── docker-compose.yml
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/             ← migraciones generadas
│   ├── app/
│   │   ├── main.py               ← app FastAPI, CORS, routers
│   │   ├── config.py             ← Settings desde .env con pydantic-settings
│   │   ├── database.py           ← engine, SessionLocal, Base, get_db
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py           ← User + UserRole enum
│   │   │   └── child_profile.py  ← ChildProfile (creado por parent)
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   └── auth.py           ← RegisterRequest, LoginRequest, TokenResponse, UserResponse
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   └── auth.py           ← /register, /login, /me
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   └── auth_service.py   ← register_user, authenticate_user
│   │   └── core/
│   │       ├── __init__.py
│   │       ├── security.py       ← hash_password, verify_password, create_access_token, decode_token
│   │       └── dependencies.py   ← get_current_user (Depends)
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py           ← fixtures: SQLite in-memory, TestClient
│       └── test_auth.py          ← tests de register, login, /me
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css             ← @import Nunito, @tailwind directives, base styles
        ├── context/
        │   └── AuthContext.jsx   ← AuthProvider, useAuth hook
        ├── services/
        │   └── api.js            ← axios instance, interceptors, authApi
        ├── router/
        │   └── index.jsx         ← createBrowserRouter, ProtectedRoute
        ├── components/
        │   ├── ui/
        │   │   ├── Button.jsx
        │   │   ├── Input.jsx
        │   │   └── Card.jsx
        │   ├── layout/
        │   │   └── PageWrapper.jsx
        │   └── lumi/
        │       └── LumiCharacter.jsx   ← SVG owl + Framer Motion states
        ├── pages/
        │   ├── Welcome.jsx
        │   ├── Login.jsx
        │   ├── Register.jsx
        │   └── Dashboard.jsx
        └── test/
            ├── setup.js
            └── Button.test.jsx
```

---

### Task 1: Scaffolding del proyecto y Docker

**Files:**
- Create: `.gitignore`
- Create: `.gitattributes`
- Create: `.env.example`
- Create: `docker-compose.yml`

**Interfaces:**
- Produce: servicios `db`, `backend`, `frontend` en red `socialmind_net`; volumen `postgres_data`; variables de entorno leídas desde `.env`

---

- [ ] **Step 1: Inicializar git**

Ejecutar en PowerShell desde `C:\Users\distu\socialmind`:

```powershell
git init
```

Expected: `Initialized empty Git repository in C:/Users/distu/socialmind/.git/`

- [ ] **Step 2: Crear `.gitattributes`**

Crear archivo `C:\Users\distu\socialmind\.gitattributes`:

```
* text=auto eol=lf
*.bat text eol=crlf
*.cmd text eol=crlf
```

- [ ] **Step 3: Crear `.gitignore`**

Crear archivo `C:\Users\distu\socialmind\.gitignore`:

```
# Environment
.env
*.env.local

# Python
__pycache__/
*.pyc
*.pyo
.pytest_cache/
*.egg-info/
dist/
build/
venv/
.venv/
test.db
*.db

# Node
node_modules/
frontend/dist/
frontend/.vite/

# Docker
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo
```

- [ ] **Step 4: Crear `.env.example`**

Crear archivo `C:\Users\distu\socialmind\.env.example`:

```bash
# Base de datos PostgreSQL
POSTGRES_DB=socialmind
POSTGRES_USER=socialmind_user
POSTGRES_PASSWORD=cambia_esto_en_produccion
DATABASE_URL=postgresql://socialmind_user:cambia_esto_en_produccion@db:5432/socialmind

# JWT
JWT_SECRET_KEY=cambia_esto_a_una_cadena_larga_y_aleatoria
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60

# App
APP_ENV=development
CORS_ORIGINS=http://localhost:3000

# Anthropic (para etapas futuras)
ANTHROPIC_API_KEY=tu_api_key_aqui
```

- [ ] **Step 5: Copiar `.env.example` a `.env` y completarlo**

En PowerShell:

```powershell
Copy-Item .env.example .env
```

Luego abrir `.env` y cambiar:
- `POSTGRES_PASSWORD` → una contraseña segura
- `JWT_SECRET_KEY` → una cadena aleatoria larga (mínimo 32 caracteres)
- `ANTHROPIC_API_KEY` → tu API key real de Anthropic

- [ ] **Step 6: Crear `docker-compose.yml`**

Crear archivo `C:\Users\distu\socialmind\docker-compose.yml`:

```yaml
version: '3.9'

services:
  db:
    image: postgres:15-alpine
    container_name: socialmind_db
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - socialmind_net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: socialmind_backend
    env_file:
      - .env
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy
    networks:
      - socialmind_net
    volumes:
      - ./backend:/app
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: socialmind_frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
    networks:
      - socialmind_net
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:8000

volumes:
  postgres_data:

networks:
  socialmind_net:
    driver: bridge
```

- [ ] **Step 7: Commit inicial**

```powershell
git add .gitignore .gitattributes .env.example docker-compose.yml
git commit -m "chore: scaffolding inicial del proyecto SocialMind"
```

---

### Task 2: Backend — Fundación FastAPI

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/requirements.txt`
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/app/database.py`
- Create: `backend/app/main.py`

**Interfaces:**
- Produce: `GET /health` → `{"status": "ok", "service": "socialmind-api"}`
- Produce: `settings` object (importable desde `app.config`)
- Produce: `get_db` dependency, `Base` class (importable desde `app.database`)

---

- [ ] **Step 1: Crear estructura de directorios del backend**

```powershell
New-Item -ItemType Directory -Force -Path backend/app/models
New-Item -ItemType Directory -Force -Path backend/app/schemas
New-Item -ItemType Directory -Force -Path backend/app/routers
New-Item -ItemType Directory -Force -Path backend/app/services
New-Item -ItemType Directory -Force -Path backend/app/core
New-Item -ItemType Directory -Force -Path backend/tests
```

- [ ] **Step 2: Crear `backend/requirements.txt`**

```
fastapi==0.111.0
uvicorn[standard]==0.30.0
sqlalchemy==2.0.30
alembic==1.13.1
psycopg2-binary==2.9.9
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
python-dotenv==1.0.1
pydantic==2.7.1
pydantic-settings==2.3.0
httpx==0.27.0
pytest==8.2.0
pytest-asyncio==0.23.6
```

- [ ] **Step 3: Crear `backend/Dockerfile`**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

- [ ] **Step 4: Crear `backend/app/__init__.py`**

```python
```
(archivo vacío)

- [ ] **Step 5: Crear `backend/app/config.py`**

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:3000"
    app_env: str = "development"

    class Config:
        env_file = ".env"

settings = Settings()
```

- [ ] **Step 6: Crear `backend/app/database.py`**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 7: Crear `backend/app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

app = FastAPI(
    title="SocialMind API",
    description="Plataforma de apoyo social para personas en el espectro autista",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["sistema"])
def health_check():
    return {"status": "ok", "service": "socialmind-api"}
```

- [ ] **Step 8: Verificar que el backend arranca con Docker**

```powershell
docker compose up db backend --build -d
```

Esperar ~20 segundos y verificar:

```powershell
Invoke-RestMethod -Uri http://localhost:8000/health
```

Expected output:
```json
{"status": "ok", "service": "socialmind-api"}
```

Si hay error, verificar logs:
```powershell
docker compose logs backend --tail=30
```

- [ ] **Step 9: Commit**

```powershell
git add backend/
git commit -m "feat: backend FastAPI base con health check y configuración Docker"
```

---

### Task 3: Backend — Modelos de datos y migraciones Alembic

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/user.py`
- Create: `backend/app/models/child_profile.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Modify: `backend/app/main.py` (importar modelos antes de Alembic)

**Interfaces:**
- Produce: clase `User` con campos `id, email, hashed_password, full_name, role, is_active, created_at`
- Produce: clase `ChildProfile` con campos `id, parent_id, name, age, avatar_emoji, created_at`
- Produce: enum `UserRole` con valores `admin, parent, specialist`

---

- [ ] **Step 1: Crear `backend/app/models/user.py`**

```python
import enum
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Enum, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    parent = "parent"
    specialist = "specialist"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.parent, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    child_profiles: Mapped[list["ChildProfile"]] = relationship(
        "ChildProfile", back_populates="parent", cascade="all, delete-orphan"
    )
```

- [ ] **Step 2: Crear `backend/app/models/child_profile.py`**

```python
from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ChildProfile(Base):
    __tablename__ = "child_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    parent_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    avatar_emoji: Mapped[str] = mapped_column(String(10), default="⭐", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    parent: Mapped["User"] = relationship("User", back_populates="child_profiles")
```

- [ ] **Step 3: Crear `backend/app/models/__init__.py`**

```python
from app.models.user import User, UserRole
from app.models.child_profile import ChildProfile

__all__ = ["User", "UserRole", "ChildProfile"]
```

- [ ] **Step 4: Configurar Alembic — crear `backend/alembic.ini`**

```ini
[alembic]
script_location = alembic
prepend_sys_path = .
sqlalchemy.url = driver://user:pass@localhost/dbname

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 5: Crear directorio alembic y `backend/alembic/env.py`**

```powershell
New-Item -ItemType Directory -Force -Path backend/alembic/versions
New-Item -ItemType File -Force -Path backend/alembic/script.py.mako
```

Crear `backend/alembic/env.py`:

```python
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
from app.config import settings
from app.database import Base
import app.models  # noqa: importar modelos para que Alembic los detecte

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

Crear `backend/alembic/script.py.mako`:

```
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 6: Generar migración inicial dentro del contenedor**

```powershell
docker compose exec backend alembic revision --autogenerate -m "crear tablas users y child_profiles"
```

Expected: `Generating /app/alembic/versions/xxxx_crear_tablas_users_y_child_profiles.py`

- [ ] **Step 7: Aplicar migración**

```powershell
docker compose exec backend alembic upgrade head
```

Expected: `Running upgrade  -> xxxx, crear tablas users y child_profiles`

- [ ] **Step 8: Verificar tablas en la base de datos**

```powershell
docker compose exec db psql -U socialmind_user -d socialmind -c "\dt"
```

Expected: tabla `users`, `child_profiles`, `alembic_version` listadas.

- [ ] **Step 9: Commit**

```powershell
git add backend/app/models/ backend/alembic/ backend/alembic.ini
git commit -m "feat: modelos User y ChildProfile con migraciones Alembic"
```

---

### Task 4: Backend — Autenticación JWT con roles y tests

**Files:**
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/security.py`
- Create: `backend/app/core/dependencies.py`
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/auth_service.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/auth.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_auth.py`

**Interfaces:**
- Consume: `User`, `UserRole` de `app.models.user`; `get_db` de `app.database`; `settings` de `app.config`
- Produce: `POST /api/v1/auth/register` → `TokenResponse`
- Produce: `POST /api/v1/auth/login` → `TokenResponse`
- Produce: `GET /api/v1/auth/me` → `UserResponse` (requiere Bearer token)

---

- [ ] **Step 1: Crear archivos `__init__.py` vacíos**

```powershell
@("backend/app/core/__init__.py","backend/app/schemas/__init__.py","backend/app/services/__init__.py","backend/app/routers/__init__.py","backend/tests/__init__.py") | ForEach-Object { New-Item -ItemType File -Force -Path $_ }
```

- [ ] **Step 2: Crear `backend/app/core/security.py`**

```python
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
```

- [ ] **Step 3: Crear `backend/app/schemas/auth.py`**

```python
from pydantic import BaseModel, EmailStr
from app.models.user import UserRole


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole = UserRole.parent


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: str
    full_name: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Crear `backend/app/services/auth_service.py`**

```python
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest
from app.core.security import hash_password, verify_password, create_access_token


def register_user(db: Session, data: RegisterRequest) -> User:
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una cuenta con este correo electrónico.",
        )
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, data: LoginRequest) -> tuple[str, User]:
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta cuenta no está activa.",
        )
    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return token, user
```

- [ ] **Step 5: Crear `backend/app/core/dependencies.py`**

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError
from app.database import get_db
from app.models.user import User
from app.core.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado.",
        )
    return user
```

- [ ] **Step 6: Crear `backend/app/routers/auth.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse
from app.services.auth_service import register_user, authenticate_user
from app.core.dependencies import get_current_user
from app.models.user import User

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    user = register_user(db, data)
    login_data = LoginRequest(email=data.email, password=data.password)
    token, _ = authenticate_user(db, login_data)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        role=user.role.value,
        full_name=user.full_name,
    )


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    token, user = authenticate_user(db, data)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        role=user.role.value,
        full_name=user.full_name,
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
```

- [ ] **Step 7: Actualizar `backend/app/main.py` para registrar el router**

Reemplazar el contenido completo de `backend/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth

app = FastAPI(
    title="SocialMind API",
    description="Plataforma de apoyo social para personas en el espectro autista",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["autenticación"])


@app.get("/health", tags=["sistema"])
def health_check():
    return {"status": "ok", "service": "socialmind-api"}
```

- [ ] **Step 8: Crear `backend/tests/conftest.py`**

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, get_db

TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

- [ ] **Step 9: Escribir tests en `backend/tests/test_auth.py`**

```python
def test_register_parent(client):
    response = client.post("/api/v1/auth/register", json={
        "email": "padre@example.com",
        "password": "Password123!",
        "full_name": "Juan García",
        "role": "parent",
    })
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "parent"
    assert data["full_name"] == "Juan García"


def test_register_specialist(client):
    response = client.post("/api/v1/auth/register", json={
        "email": "psicologo@example.com",
        "password": "Password123!",
        "full_name": "Dra. Ana López",
        "role": "specialist",
    })
    assert response.status_code == 201
    assert response.json()["role"] == "specialist"


def test_register_duplicate_email(client):
    payload = {"email": "padre@example.com", "password": "Password123!", "full_name": "Test", "role": "parent"}
    client.post("/api/v1/auth/register", json=payload)
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert "correo electrónico" in response.json()["detail"]


def test_login_valid(client):
    client.post("/api/v1/auth/register", json={
        "email": "padre@example.com", "password": "Password123!", "full_name": "Juan", "role": "parent",
    })
    response = client.post("/api/v1/auth/login", json={
        "email": "padre@example.com", "password": "Password123!",
    })
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_wrong_password(client):
    client.post("/api/v1/auth/register", json={
        "email": "padre@example.com", "password": "Password123!", "full_name": "Juan", "role": "parent",
    })
    response = client.post("/api/v1/auth/login", json={
        "email": "padre@example.com", "password": "ClaveIncorrecta",
    })
    assert response.status_code == 401


def test_login_unknown_email(client):
    response = client.post("/api/v1/auth/login", json={
        "email": "noexiste@example.com", "password": "Password123!",
    })
    assert response.status_code == 401


def test_get_me_authenticated(client):
    client.post("/api/v1/auth/register", json={
        "email": "padre@example.com", "password": "Password123!", "full_name": "Juan García", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={"email": "padre@example.com", "password": "Password123!"})
    token = login.json()["access_token"]
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "padre@example.com"


def test_get_me_unauthenticated(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_get_me_invalid_token(client):
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer token_invalido"})
    assert response.status_code == 401
```

- [ ] **Step 10: Ejecutar los tests**

```powershell
docker compose exec backend pytest tests/ -v
```

Expected: todos los tests en verde (`8 passed`).

Si falla algún test, leer el mensaje de error y corregir antes de continuar.

- [ ] **Step 11: Verificar manualmente el endpoint en el navegador**

Abrir: `http://localhost:8000/docs`

Probar el flujo: Register → Login → GET /me con el token obtenido.

- [ ] **Step 12: Commit**

```powershell
git add backend/
git commit -m "feat: autenticacion JWT con roles (parent, specialist, admin) y tests"
```

---

### Task 5: Frontend — Setup con Vite, React, Tailwind y Framer Motion

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/index.css`
- Create: `frontend/src/test/setup.js`
- Create: `frontend/Dockerfile`

**Interfaces:**
- Produce: servidor de desarrollo en `http://localhost:3000`
- Produce: paleta de colores SocialMind disponible como clases Tailwind (`bg-primary-500`, `text-text-secondary`, etc.)

---

- [ ] **Step 1: Crear `frontend/package.json`**

```json
{
  "name": "socialmind-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.0",
    "framer-motion": "^11.2.0",
    "axios": "^1.7.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.2.0",
    "tailwindcss": "^3.4.3",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "vitest": "^1.6.0",
    "@testing-library/react": "^15.0.7",
    "@testing-library/user-event": "^14.5.2",
    "@testing-library/jest-dom": "^6.4.5",
    "jsdom": "^24.1.0"
  }
}
```

- [ ] **Step 2: Crear `frontend/vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
  },
})
```

- [ ] **Step 3: Crear `frontend/postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 4: Crear `frontend/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EEF4FB',
          100: '#D6E6F5',
          500: '#6B9FD4',
          600: '#5589C0',
          700: '#3E72AB',
        },
        secondary: {
          50: '#EDF6F1',
          100: '#D1EBE0',
          500: '#8BC4A8',
          600: '#6EB190',
        },
        calm: {
          bg: '#F8F6F0',
          surface: '#FFFFFF',
          border: '#E8E4DC',
        },
        accent: {
          yellow: '#F4C878',
          coral: '#F49878',
        },
        text: {
          primary: '#2D2D2D',
          secondary: '#5C5C5C',
          muted: '#8C8C8C',
        },
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs:   ['16px', '24px'],
        sm:   ['18px', '28px'],
        base: ['20px', '30px'],
        lg:   ['24px', '34px'],
        xl:   ['28px', '38px'],
        '2xl':['32px', '42px'],
        '3xl':['40px', '50px'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 5: Crear `frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="SocialMind — Plataforma de apoyo social para personas en el espectro autista" />
    <title>SocialMind</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Crear `frontend/src/index.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-calm-bg text-text-primary font-sans;
    -webkit-font-smoothing: antialiased;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

- [ ] **Step 7: Crear `frontend/src/test/setup.js`**

```js
import '@testing-library/jest-dom'
```

- [ ] **Step 8: Crear `frontend/src/main.jsx` temporal**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

function App() {
  return (
    <div className="min-h-screen bg-calm-bg flex items-center justify-center">
      <h1 className="text-2xl font-bold text-primary-700">SocialMind cargando...</h1>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 9: Crear `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
```

- [ ] **Step 10: Levantar el frontend y verificar**

```powershell
docker compose up frontend --build -d
```

Abrir en el navegador: `http://localhost:3000`

Expected: página con fondo color `#F8F6F0` y texto "SocialMind cargando..." en azul.

Si el color de fondo es blanco en lugar de crema, verificar que Tailwind está procesando las clases correctamente en los logs del contenedor.

- [ ] **Step 11: Crear `frontend/src/App.jsx` vacío para uso posterior**

```jsx
export default function App() {
  return null
}
```

- [ ] **Step 12: Commit**

```powershell
git add frontend/
git commit -m "feat: frontend base con Vite, React, Tailwind y paleta de diseno SocialMind"
```

---

### Task 6: Frontend — Sistema de diseño y personaje Lumi

**Files:**
- Create: `frontend/src/components/ui/Button.jsx`
- Create: `frontend/src/components/ui/Input.jsx`
- Create: `frontend/src/components/ui/Card.jsx`
- Create: `frontend/src/components/layout/PageWrapper.jsx`
- Create: `frontend/src/components/lumi/LumiCharacter.jsx`
- Create: `frontend/src/test/Button.test.jsx`

**Interfaces:**
- Produce: `<Button variant="primary|secondary|ghost">`, `<Input label error>`, `<Card animate>`, `<PageWrapper>`, `<LumiCharacter state="idle|happy|thinking|encouraging" size>`

---

- [ ] **Step 1: Crear directorios de componentes**

```powershell
New-Item -ItemType Directory -Force -Path frontend/src/components/ui
New-Item -ItemType Directory -Force -Path frontend/src/components/layout
New-Item -ItemType Directory -Force -Path frontend/src/components/lumi
```

- [ ] **Step 2: Escribir el test de Button primero**

Crear `frontend/src/test/Button.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../components/ui/Button'

describe('Button', () => {
  it('muestra el texto del botón', () => {
    render(<Button>Comenzar</Button>)
    expect(screen.getByRole('button', { name: 'Comenzar' })).toBeInTheDocument()
  })

  it('llama a onClick cuando se hace clic', async () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Clic aquí</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('está deshabilitado cuando disabled es true', () => {
    render(<Button disabled>Deshabilitado</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('no llama a onClick cuando está deshabilitado', async () => {
    const handleClick = vi.fn()
    render(<Button disabled onClick={handleClick}>Deshabilitado</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(handleClick).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Ejecutar tests para verificar que fallan**

```powershell
docker compose exec frontend npm test -- --run
```

Expected: `FAIL` — "Cannot find module '../components/ui/Button'"

- [ ] **Step 4: Crear `frontend/src/components/ui/Button.jsx`**

```jsx
import { motion } from 'framer-motion'

const variantClasses = {
  primary: 'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 focus:ring-primary-100',
  secondary: 'bg-secondary-500 text-white hover:bg-secondary-600 active:bg-secondary-600 focus:ring-secondary-100',
  ghost: 'bg-transparent text-primary-600 hover:bg-primary-50 focus:ring-primary-100',
}

export function Button({ children, variant = 'primary', className = '', disabled = false, type = 'button', ...props }) {
  return (
    <motion.button
      whileTap={disabled ? {} : { scale: 0.97 }}
      type={type}
      className={`
        font-bold rounded-3xl px-8 py-4 min-h-[56px] min-w-[44px]
        transition-colors focus:outline-none focus:ring-4
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant] || variantClasses.primary}
        ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  )
}
```

- [ ] **Step 5: Ejecutar tests para verificar que pasan**

```powershell
docker compose exec frontend npm test -- --run
```

Expected: `4 passed`

- [ ] **Step 6: Crear `frontend/src/components/ui/Input.jsx`**

```jsx
export function Input({ label, error, id, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={id} className="font-semibold text-text-primary text-sm">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`
          w-full border-2 rounded-2xl px-4 py-3 text-base text-text-primary bg-calm-surface
          focus:outline-none transition-colors min-h-[56px]
          ${error
            ? 'border-accent-coral focus:border-accent-coral'
            : 'border-calm-border focus:border-primary-500'
          }
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="text-accent-coral text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Crear `frontend/src/components/ui/Card.jsx`**

```jsx
import { motion } from 'framer-motion'

export function Card({ children, className = '', animate = false, ...props }) {
  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className={`bg-calm-surface rounded-3xl p-6 border border-calm-border shadow-sm ${className}`}
        {...props}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div
      className={`bg-calm-surface rounded-3xl p-6 border border-calm-border shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 8: Crear `frontend/src/components/layout/PageWrapper.jsx`**

```jsx
import { motion } from 'framer-motion'

export function PageWrapper({ children, className = '' }) {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={`min-h-screen bg-calm-bg flex flex-col ${className}`}
    >
      {children}
    </motion.main>
  )
}
```

- [ ] **Step 9: Crear `frontend/src/components/lumi/LumiCharacter.jsx`**

Lumi es un búho amigable: cuerpo azul-suave, ojos grandes expresivos, plumas verdes, pico amarillo.

```jsx
import { motion } from 'framer-motion'

// Lumi — búho simpático, mascota de SocialMind
// states: idle (flotando suave), happy (salta con brillos), thinking (ladea la cabeza), encouraging (flota más alto)
export function LumiCharacter({ state = 'idle', size = 120, className = '' }) {
  const isHappy = state === 'happy' || state === 'encouraging'
  const floatAmount = isHappy ? -10 : -6
  const floatDuration = isHappy ? 2.5 : 3.5

  return (
    <motion.div
      className={`inline-flex items-center justify-center select-none ${className}`}
      animate={{ y: [0, floatAmount, 0] }}
      transition={{ duration: floatDuration, repeat: Infinity, ease: 'easeInOut' }}
      role="img"
      aria-label="Lumi, tu compañero de SocialMind"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Cuerpo principal */}
        <ellipse cx="60" cy="76" rx="36" ry="38" fill="#8BC4A8" />

        {/* Cabeza */}
        <circle cx="60" cy="44" r="30" fill="#6B9FD4" />

        {/* Ala izquierda */}
        <ellipse cx="27" cy="80" rx="13" ry="19" fill="#5589C0" transform="rotate(-12 27 80)" />

        {/* Ala derecha */}
        <ellipse cx="93" cy="80" rx="13" ry="19" fill="#5589C0" transform="rotate(12 93 80)" />

        {/* Barriga */}
        <ellipse cx="60" cy="84" rx="22" ry="22" fill="#A8D5BE" />

        {/* Orejas (mechones) */}
        <polygon points="38,16 32,30 46,28" fill="#5589C0" />
        <polygon points="82,16 74,28 88,30" fill="#5589C0" />

        {/* Ojos — blancos */}
        <circle cx="46" cy="42" r="12" fill="white" />
        <circle cx="74" cy="42" r="12" fill="white" />

        {/* Pupilas */}
        <motion.g
          animate={{ scaleY: state === 'happy' ? 0.65 : 1 }}
          transition={{ duration: 0.25 }}
          style={{ transformOrigin: '60px 42px' }}
        >
          <circle cx="46" cy="44" r="7" fill="#2D2D2D" />
          <circle cx="74" cy="44" r="7" fill="#2D2D2D" />
          {/* Brillos en los ojos */}
          <circle cx="49" cy="41" r="2.5" fill="white" />
          <circle cx="77" cy="41" r="2.5" fill="white" />
        </motion.g>

        {/* Pico */}
        <polygon points="60,54 53,63 67,63" fill="#F4C878" />

        {/* Patas */}
        <ellipse cx="48" cy="110" rx="11" ry="5" fill="#F4C878" />
        <ellipse cx="72" cy="110" rx="11" ry="5" fill="#F4C878" />

        {/* Pensando — tilde encima */}
        {state === 'thinking' && (
          <motion.text
            x="84" y="20"
            fontSize="18"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            🤔
          </motion.text>
        )}

        {/* Feliz / Alentando — brillos */}
        {isHappy && (
          <motion.g
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <text x="6" y="28" fontSize="16">✨</text>
            <text x="90" y="28" fontSize="16">✨</text>
          </motion.g>
        )}
      </svg>
    </motion.div>
  )
}
```

- [ ] **Step 10: Verificar visualmente Lumi en el navegador**

Modificar temporalmente `frontend/src/main.jsx` para ver a Lumi:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { LumiCharacter } from './components/lumi/LumiCharacter'

function Preview() {
  return (
    <div className="min-h-screen bg-calm-bg flex flex-col items-center justify-center gap-8">
      <h1 className="text-2xl font-bold text-primary-700">Hola, soy Lumi</h1>
      <div className="flex gap-8">
        <LumiCharacter state="idle" size={120} />
        <LumiCharacter state="happy" size={120} />
        <LumiCharacter state="thinking" size={120} />
        <LumiCharacter state="encouraging" size={120} />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode><Preview /></StrictMode>
)
```

Abrir `http://localhost:3000` y verificar que Lumi aparece en sus 4 estados con animación de flotación.

- [ ] **Step 11: Commit**

```powershell
git add frontend/src/components/ frontend/src/test/
git commit -m "feat: sistema de diseno SocialMind y personaje Lumi con animaciones"
```

---

### Task 7: Frontend — Auth flow completo (contexto, servicios, páginas, router)

**Files:**
- Create: `frontend/src/services/api.js`
- Create: `frontend/src/context/AuthContext.jsx`
- Create: `frontend/src/router/index.jsx`
- Create: `frontend/src/pages/Welcome.jsx`
- Create: `frontend/src/pages/Login.jsx`
- Create: `frontend/src/pages/Register.jsx`
- Create: `frontend/src/pages/Dashboard.jsx`
- Modify: `frontend/src/main.jsx` (versión final)
- Modify: `frontend/src/App.jsx` (versión final)

**Interfaces:**
- Consume: `Button`, `Input`, `Card`, `PageWrapper`, `LumiCharacter`
- Consume: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`
- Produce: rutas `/` (Welcome), `/login`, `/registro`, `/inicio` (Dashboard protegido)
- Produce: hook `useAuth()` → `{ user, login, register, logout, loading }`

---

- [ ] **Step 1: Crear directorios restantes**

```powershell
New-Item -ItemType Directory -Force -Path frontend/src/services
New-Item -ItemType Directory -Force -Path frontend/src/context
New-Item -ItemType Directory -Force -Path frontend/src/router
New-Item -ItemType Directory -Force -Path frontend/src/pages
```

- [ ] **Step 2: Crear `frontend/src/services/api.js`**

```js
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sm_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sm_token')
      localStorage.removeItem('sm_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  getMe:    ()     => api.get('/auth/me'),
}
```

- [ ] **Step 3: Crear `frontend/src/context/AuthContext.jsx`**

```jsx
import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('sm_user')
    const token  = localStorage.getItem('sm_token')
    if (stored && token) {
      setUser(JSON.parse(stored))
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const { data } = await authApi.login({ email, password })
    const userData = { id: data.user_id, role: data.role, full_name: data.full_name }
    localStorage.setItem('sm_token', data.access_token)
    localStorage.setItem('sm_user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }

  const register = async (formData) => {
    const { data } = await authApi.register(formData)
    const userData = { id: data.user_id, role: data.role, full_name: data.full_name }
    localStorage.setItem('sm_token', data.access_token)
    localStorage.setItem('sm_user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }

  const logout = () => {
    localStorage.removeItem('sm_token')
    localStorage.removeItem('sm_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
```

- [ ] **Step 4: Crear `frontend/src/pages/Welcome.jsx`**

```jsx
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

export function Welcome() {
  const navigate = useNavigate()

  return (
    <PageWrapper className="items-center justify-center px-6 py-12">
      <div className="max-w-md w-full flex flex-col items-center gap-8 text-center">

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <LumiCharacter state="happy" size={160} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col gap-3"
        >
          <h1 className="text-3xl font-extrabold text-primary-700">
            Hola, soy Lumi
          </h1>
          <p className="text-base text-text-secondary leading-relaxed">
            Bienvenido a SocialMind. Aquí aprenderemos juntos habilidades sociales de forma sencilla y tranquila.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col gap-4 w-full"
        >
          <Button onClick={() => navigate('/registro')} className="w-full text-lg">
            Comenzar
          </Button>
          <Button variant="ghost" onClick={() => navigate('/login')} className="w-full">
            Ya tengo una cuenta
          </Button>
        </motion.div>

      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 5: Crear `frontend/src/pages/Login.jsx`**

```jsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

export function Login() {
  const navigate          = useNavigate()
  const { login }         = useAuth()
  const [form, setForm]   = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/inicio')
    } catch (err) {
      setError(err.response?.data?.detail || 'Hubo un error. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper className="items-center justify-center px-6 py-12">
      <div className="max-w-md w-full flex flex-col items-center gap-6">
        <LumiCharacter state="idle" size={100} />

        <Card animate className="w-full">
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-extrabold text-primary-700">Entrar a SocialMind</h1>
              <p className="text-sm text-text-secondary mt-1">Escribe tu correo y contraseña</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <Input
                id="email"
                name="email"
                type="email"
                label="Correo electrónico"
                placeholder="tu@correo.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
              <Input
                id="password"
                name="password"
                type="password"
                label="Contraseña"
                placeholder="Tu contraseña"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
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

              <Button type="submit" disabled={loading} className="w-full mt-2">
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>

            <p className="text-center text-sm text-text-secondary">
              ¿No tienes cuenta?{' '}
              <Link to="/registro" className="text-primary-600 font-semibold underline">
                Regístrate aquí
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 6: Crear `frontend/src/pages/Register.jsx`**

```jsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

const ROLE_OPTIONS = [
  { value: 'parent',     label: 'Padre / Madre / Tutor' },
  { value: 'specialist', label: 'Especialista (Terapeuta, Psicólogo, Docente)' },
]

export function Register() {
  const navigate          = useNavigate()
  const { register }      = useAuth()
  const [form, setForm]   = useState({ email: '', password: '', full_name: '', role: 'parent' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    setLoading(true)
    try {
      await register(form)
      navigate('/inicio')
    } catch (err) {
      setError(err.response?.data?.detail || 'Hubo un error. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper className="items-center justify-center px-6 py-12">
      <div className="max-w-md w-full flex flex-col items-center gap-6">
        <LumiCharacter state="encouraging" size={100} />

        <Card animate className="w-full">
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-extrabold text-primary-700">Crear cuenta</h1>
              <p className="text-sm text-text-secondary mt-1">Es fácil y rápido</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <Input
                id="full_name"
                name="full_name"
                type="text"
                label="Tu nombre completo"
                placeholder="Ejemplo: Ana García"
                value={form.full_name}
                onChange={handleChange}
                autoComplete="name"
                required
              />
              <Input
                id="email"
                name="email"
                type="email"
                label="Correo electrónico"
                placeholder="tu@correo.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
              <Input
                id="password"
                name="password"
                type="password"
                label="Contraseña"
                placeholder="Mínimo 8 caracteres"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />

              <div className="flex flex-col gap-2">
                <p className="font-semibold text-text-primary text-sm">Soy...</p>
                <div className="flex flex-col gap-2">
                  {ROLE_OPTIONS.map(opt => (
                    <label
                      key={opt.value}
                      className={`
                        flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-colors
                        ${form.role === opt.value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-calm-border bg-calm-surface hover:border-primary-100'
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={opt.value}
                        checked={form.role === opt.value}
                        onChange={handleChange}
                        className="accent-primary-500 w-5 h-5"
                      />
                      <span className="text-sm text-text-primary font-medium">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

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

              <Button type="submit" disabled={loading} className="w-full mt-2">
                {loading ? 'Creando cuenta...' : 'Crear mi cuenta'}
              </Button>
            </form>

            <p className="text-center text-sm text-text-secondary">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="text-primary-600 font-semibold underline">
                Entra aquí
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 7: Crear `frontend/src/pages/Dashboard.jsx`**

```jsx
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

const ROLE_LABELS = {
  parent:     'Familia',
  specialist: 'Especialista',
  admin:      'Administrador',
}

const MODULE_CARDS = [
  { emoji: '😊', title: 'Selector emocional',   desc: 'Próximamente',  available: false },
  { emoji: '🤝', title: 'Escenarios sociales',  desc: 'Próximamente',  available: false },
  { emoji: '🧘', title: 'Zona de calma',        desc: 'Próximamente',  available: false },
]

export function Dashboard() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()
  const firstName        = user?.full_name?.split(' ')[0] || 'Bienvenido'

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <PageWrapper className="px-6 py-10">
      <div className="max-w-lg mx-auto w-full flex flex-col gap-8">

        {/* Cabecera */}
        <div className="flex items-center gap-4">
          <LumiCharacter state="happy" size={80} />
          <div>
            <h1 className="text-xl font-extrabold text-primary-700">
              ¡Hola, {firstName}!
            </h1>
            <p className="text-sm text-text-secondary">
              {ROLE_LABELS[user?.role] || 'Usuario'}
            </p>
          </div>
        </div>

        {/* Módulos */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-text-primary">Módulos</h2>
          {MODULE_CARDS.map((mod, i) => (
            <motion.div
              key={mod.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="flex items-center gap-4 opacity-60">
                <span className="text-3xl">{mod.emoji}</span>
                <div>
                  <p className="font-bold text-text-primary text-sm">{mod.title}</p>
                  <p className="text-xs text-text-muted">{mod.desc}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <Button variant="ghost" onClick={handleLogout} className="self-start">
          Cerrar sesión
        </Button>
      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 8: Crear `frontend/src/router/index.jsx`**

```jsx
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Welcome }   from '../pages/Welcome'
import { Login }     from '../pages/Login'
import { Register }  from '../pages/Register'
import { Dashboard } from '../pages/Dashboard'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-calm-bg flex items-center justify-center">
        <p className="text-text-secondary text-base">Cargando...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return children
}

export const router = createBrowserRouter([
  { path: '/',        element: <Welcome /> },
  { path: '/login',   element: <Login /> },
  { path: '/registro',element: <Register /> },
  {
    path: '/inicio',
    element: <ProtectedRoute><Dashboard /></ProtectedRoute>,
  },
])
```

- [ ] **Step 9: Escribir versión final de `frontend/src/App.jsx`**

```jsx
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { router } from './router'

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
```

- [ ] **Step 10: Escribir versión final de `frontend/src/main.jsx`**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 11: Ejecutar tests frontend**

```powershell
docker compose exec frontend npm test -- --run
```

Expected: `4 passed` (los tests de Button siguen pasando).

- [ ] **Step 12: Verificar flujo completo en el navegador**

Abrir `http://localhost:3000` y verificar:

1. Página `/` muestra a Lumi con animación y los dos botones
2. Click "Comenzar" → redirige a `/registro`
3. Registro exitoso → redirige a `/inicio` (Dashboard)
4. Click "Cerrar sesión" → redirige a `/`
5. Abrir `/inicio` sin sesión → redirige a `/login`
6. Login correcto → redirige a `/inicio`

- [ ] **Step 13: Verificar en Swagger que el backend funciona**

Abrir `http://localhost:8000/docs` y probar register + login + GET /me.

- [ ] **Step 14: Commit final de la Etapa 1**

```powershell
git add frontend/src/
git commit -m "feat: frontend auth completo — Welcome, Login, Registro, Dashboard y Lumi"
```

- [ ] **Step 15: Verificar que todo el stack funciona junto**

```powershell
docker compose ps
```

Expected: 3 servicios `Up` — `socialmind_db`, `socialmind_backend`, `socialmind_frontend`.

```powershell
docker compose logs --tail=10
```

Sin errores críticos en ningún servicio.

---

## Resumen de la Etapa 1

Al completar este plan, tendrás:

| Componente | Estado |
|---|---|
| Git repo inicializado | ✓ |
| Docker Compose (db + backend + frontend) | ✓ |
| PostgreSQL con tablas `users` y `child_profiles` | ✓ |
| Backend FastAPI con JWT auth y 3 endpoints | ✓ |
| Tests de backend (8 tests, todos pasando) | ✓ |
| Frontend React con paleta de diseño SocialMind | ✓ |
| Personaje Lumi (búho SVG, 4 estados, animado) | ✓ |
| Páginas: Welcome, Login, Registro, Dashboard | ✓ |
| Rutas protegidas por rol | ✓ |
| Tests de frontend (Button, 4 tests) | ✓ |

**Siguiente etapa:** Etapa 2 — Selector emocional, escenarios sociales y flujo pedagógico.
