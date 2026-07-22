# Términos y Condiciones + Política de Privacidad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public Términos y Condiciones / Política de Privacidad pages to SocialMind, with a mandatory acceptance checkbox at registration that is persisted server-side.

**Architecture:** Backend adds a `terms_accepted_at` timestamp column to `User`, enforced via a required `terms_accepted` boolean on the registration schema. Frontend adds two static content pages (`/terminos`, `/privacidad`) built on a shared `LegalDocument` layout, a small `LegalFooter` link component reused on the public pages, and a checkbox gate on the registration form that must be checked before the submit button enables.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic + pytest (backend); React + Vite + Tailwind + React Router + Vitest/Testing Library (frontend).

## Global Constraints

- All user-facing text is in Spanish (Latin America), matching the rest of the app.
- Follow existing brand styling: Nunito font via Tailwind defaults, `PageWrapper`/`Card`/`Button`/`Input` components, color classes already used elsewhere (`text-primary-700`, `text-text-secondary`, `text-accent-coral`, etc.) — no new colors introduced.
- Session storage is confirmed to be `localStorage` (`frontend/src/context/AuthContext.jsx`), not cookies — the Privacy Policy content must say this accurately.
- Both legal pages must visibly state they are a reasonable draft and not formal legal advice.
- Existing tests must keep passing — any change to `RegisterRequest` that adds a required field must update every existing test payload in the same task.
- No changes to the internal dashboard/app-shell in this phase — legal links are public-page only (Welcome, Login, Registro).

---

## Task 1: Backend — require and persist terms acceptance on registration

**Files:**
- Modify: `backend/app/models/user.py`
- Create: `backend/alembic/versions/b19b6a2f4d31_add_terms_accepted_at.py`
- Modify: `backend/app/schemas/auth.py`
- Modify: `backend/app/services/auth_service.py`
- Modify: `backend/tests/test_auth.py`

**Interfaces:**
- Produces: `RegisterRequest.terms_accepted: bool` (required) — `POST /api/v1/auth/register` returns `422` if missing or `false`. `User.terms_accepted_at: datetime | None`, set to the registration timestamp when `terms_accepted` is `true`.

- [ ] **Step 1: Update test payloads and add failing tests**

Replace the full contents of `backend/tests/test_auth.py` with:

```python
from app.models.user import User


def test_register_parent(client):
    response = client.post("/api/v1/auth/register", json={
        "email": "padre@example.com",
        "password": "Password123!",
        "full_name": "Juan García",
        "role": "parent",
        "terms_accepted": True,
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
        "terms_accepted": True,
    })
    assert response.status_code == 201
    assert response.json()["role"] == "specialist"


def test_register_invalid_role(client):
    response = client.post("/api/v1/auth/register", json={
        "email": "nino@example.com",
        "password": "Password123!",
        "full_name": "Niño Test",
        "role": "child",
        "terms_accepted": True,
    })
    assert response.status_code == 422


def test_register_duplicate_email(client):
    payload = {
        "email": "padre@example.com", "password": "Password123!",
        "full_name": "Test", "role": "parent", "terms_accepted": True,
    }
    client.post("/api/v1/auth/register", json=payload)
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert "correo electrónico" in response.json()["detail"]


def test_login_valid(client):
    client.post("/api/v1/auth/register", json={
        "email": "padre@example.com", "password": "Password123!",
        "full_name": "Juan", "role": "parent", "terms_accepted": True,
    })
    response = client.post("/api/v1/auth/login", json={
        "email": "padre@example.com", "password": "Password123!",
    })
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_wrong_password(client):
    client.post("/api/v1/auth/register", json={
        "email": "padre@example.com", "password": "Password123!",
        "full_name": "Juan", "role": "parent", "terms_accepted": True,
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
        "email": "padre@example.com", "password": "Password123!",
        "full_name": "Juan García", "role": "parent", "terms_accepted": True,
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


def test_register_admin_role_rejected(client):
    response = client.post("/api/v1/auth/register", json={
        "email": "admin@example.com",
        "password": "Password123!",
        "full_name": "Admin Malicioso",
        "role": "admin",
        "terms_accepted": True,
    })
    assert response.status_code == 400
    assert "no está permitido" in response.json()["detail"]


def test_register_short_password(client):
    response = client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "short",
        "full_name": "Test User",
        "role": "parent",
        "terms_accepted": True,
    })
    assert response.status_code == 422


def test_register_requires_terms_accepted(client):
    response = client.post("/api/v1/auth/register", json={
        "email": "sinterminos@example.com",
        "password": "Password123!",
        "full_name": "Sin Terminos",
        "role": "parent",
    })
    assert response.status_code == 422


def test_register_terms_not_accepted_rejected(client):
    response = client.post("/api/v1/auth/register", json={
        "email": "rechazoterminos@example.com",
        "password": "Password123!",
        "full_name": "Rechazo Terminos",
        "role": "parent",
        "terms_accepted": False,
    })
    assert response.status_code == 422


def test_register_success_sets_terms_accepted_at(client, db):
    response = client.post("/api/v1/auth/register", json={
        "email": "aceptaterminos@example.com",
        "password": "Password123!",
        "full_name": "Acepta Terminos",
        "role": "parent",
        "terms_accepted": True,
    })
    assert response.status_code == 201
    user = db.query(User).filter(User.email == "aceptaterminos@example.com").first()
    assert user.terms_accepted_at is not None
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd backend && python -m pytest tests/test_auth.py -v`
Expected: `test_register_requires_terms_accepted` and `test_register_terms_not_accepted_rejected` FAIL (registration currently succeeds with 201 because `terms_accepted` isn't a recognized/required field yet). `test_register_success_sets_terms_accepted_at` FAILS with `AttributeError: 'User' object has no attribute 'terms_accepted_at'`.

- [ ] **Step 3: Add the `terms_accepted_at` column to the `User` model**

In `backend/app/models/user.py`, change:

```python
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    child_profiles: Mapped[list["ChildProfile"]] = relationship(
```

to:

```python
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)

    child_profiles: Mapped[list["ChildProfile"]] = relationship(
```

- [ ] **Step 4: Add the Alembic migration**

Create `backend/alembic/versions/b19b6a2f4d31_add_terms_accepted_at.py`:

```python
"""add_terms_accepted_at

Revision ID: b19b6a2f4d31
Revises: 24c535367986
Create Date: 2026-07-21

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b19b6a2f4d31'
down_revision: Union[str, None] = '24c535367986'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('terms_accepted_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'terms_accepted_at')
```

- [ ] **Step 5: Add and validate `terms_accepted` on the schema**

In `backend/app/schemas/auth.py`, change:

```python
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole = UserRole.parent

    @field_validator('password')
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('La contraseña debe tener al menos 8 caracteres.')
        return v
```

to:

```python
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole = UserRole.parent
    terms_accepted: bool

    @field_validator('password')
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('La contraseña debe tener al menos 8 caracteres.')
        return v

    @field_validator('terms_accepted')
    @classmethod
    def terms_must_be_accepted(cls, v: bool) -> bool:
        if not v:
            raise ValueError('Debes aceptar los Términos y la Política de Privacidad para crear una cuenta.')
        return v
```

- [ ] **Step 6: Set `terms_accepted_at` when creating the user**

In `backend/app/services/auth_service.py`, change:

```python
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=data.role,
    )
```

to:

```python
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=data.role,
        terms_accepted_at=datetime.now(timezone.utc),
    )
```

(`datetime` and `timezone` are already imported at the top of this file.)

- [ ] **Step 7: Run tests to verify everything passes**

Run: `cd backend && python -m pytest tests/test_auth.py -v`
Expected: all 14 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/app/models/user.py backend/alembic/versions/b19b6a2f4d31_add_terms_accepted_at.py backend/app/schemas/auth.py backend/app/services/auth_service.py backend/tests/test_auth.py
git commit -m "feat: require and persist terms acceptance on registration"
```

---

## Task 2: Frontend — Términos y Privacidad pages

**Files:**
- Create: `frontend/src/components/layout/LegalDocument.jsx`
- Create: `frontend/src/pages/TerminosPage.jsx`
- Create: `frontend/src/pages/PrivacidadPage.jsx`
- Modify: `frontend/src/router/index.jsx`
- Create: `frontend/src/test/LegalPages.test.jsx`

**Interfaces:**
- Produces: named export `LegalDocument({ title, updatedLabel, children })` from `components/layout/LegalDocument.jsx`; named exports `TerminosPage` and `PrivacidadPage`; public routes `/terminos` and `/privacidad`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/test/LegalPages.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TerminosPage } from '../pages/TerminosPage'
import { PrivacidadPage } from '../pages/PrivacidadPage'

describe('TerminosPage', () => {
  it('muestra el título y la cláusula de propiedad intelectual', () => {
    render(<MemoryRouter><TerminosPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: /Términos y Condiciones/i })).toBeInTheDocument()
    expect(screen.getByText(/prohibido copiar, reproducir/i)).toBeInTheDocument()
  })

  it('incluye el enlace para volver a SocialMind', () => {
    render(<MemoryRouter><TerminosPage /></MemoryRouter>)
    expect(screen.getByRole('link', { name: /Volver a SocialMind/i })).toBeInTheDocument()
  })
})

describe('PrivacidadPage', () => {
  it('muestra el título y menciona el almacenamiento local', () => {
    render(<MemoryRouter><PrivacidadPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: /Política de Privacidad/i })).toBeInTheDocument()
    expect(screen.getByText(/almacenamiento local/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/test/LegalPages.test.jsx`
Expected: FAIL — `Failed to resolve import "../pages/TerminosPage"` (module doesn't exist yet).

- [ ] **Step 3: Create the shared `LegalDocument` layout**

Create `frontend/src/components/layout/LegalDocument.jsx`:

```jsx
import { Link } from 'react-router-dom'
import { PageWrapper } from './PageWrapper'
import { Card } from '../ui/Card'

export function LegalDocument({ title, updatedLabel, children }) {
  return (
    <PageWrapper className="items-center px-6 py-12">
      <div className="max-w-2xl w-full flex flex-col gap-6">
        <div className="text-center">
          <Link to="/" className="text-sm text-primary-600 hover:underline">
            ← Volver a SocialMind
          </Link>
          <h1 className="text-2xl font-extrabold text-primary-700 mt-3">{title}</h1>
          <p className="text-xs text-text-secondary mt-1">{updatedLabel}</p>
        </div>
        <Card className="flex flex-col gap-6 text-text-primary text-sm leading-relaxed">
          {children}
        </Card>
      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 4: Create `TerminosPage.jsx`**

Create `frontend/src/pages/TerminosPage.jsx`:

```jsx
import { LegalDocument } from '../components/layout/LegalDocument'

export function TerminosPage() {
  return (
    <LegalDocument title="Términos y Condiciones" updatedLabel="Última actualización: 21 de julio de 2026">
      <section>
        <h2 className="font-bold text-primary-700 mb-1">1. Qué es SocialMind</h2>
        <p>
          SocialMind es una plataforma digital de acompañamiento pedagógico dirigida a niños y adolescentes
          en el espectro autista (grado 1), pensada para practicar habilidades sociales y emocionales bajo
          la supervisión de un padre, madre, tutor o especialista responsable. El uso de la plataforma por
          parte de un menor de edad debe realizarse siempre a través de la cuenta y bajo la supervisión de
          un adulto responsable registrado en SocialMind.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">2. Cuentas</h2>
        <p>
          Para usar SocialMind debes crear una cuenta como Padre/Madre/Tutor o como Especialista (terapeuta,
          psicólogo o docente). Al registrarte, te comprometes a proporcionar información veraz y a mantener
          la confidencialidad de tu contraseña. Eres responsable de toda la actividad que ocurra bajo tu
          cuenta. Las cuentas de administrador se asignan de forma interna y no están disponibles mediante
          el registro público.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">3. Uso permitido y prohibido</h2>
        <p>
          Puedes usar SocialMind para el acompañamiento pedagógico de los niños y niñas bajo tu
          responsabilidad, dentro de los límites descritos en esta plataforma. Queda expresamente
          <strong> prohibido copiar, reproducir, distribuir, publicar, modificar, realizar ingeniería
          inversa, hacer scraping automatizado o reutilizar</strong>, total o parcialmente, el contenido,
          los textos, las ilustraciones, el diseño visual, la estructura pedagógica o el código de
          SocialMind sin autorización previa y por escrito. Esta prohibición aplica tanto a fines
          comerciales como no comerciales.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">4. Naturaleza no clínica</h2>
        <p>
          SocialMind es una herramienta pedagógica y de acompañamiento. No constituye un servicio de
          diagnóstico, tratamiento ni asesoría médica o psicológica, y no reemplaza el criterio ni el
          trabajo de un profesional de la salud. Ante cualquier señal de malestar significativo, se
          recomienda consultar con un especialista.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">5. Uso de inteligencia artificial (Lumi)</h2>
        <p>
          Lumi, el personaje guía de la plataforma, utiliza inteligencia artificial para ofrecer
          conversaciones guiadas y contenido de apoyo emocional. Las respuestas de Lumi son generadas
          automáticamente, pueden no ser perfectas, y no deben interpretarse como consejo clínico. Se
          recomienda la supervisión de un adulto responsable durante el uso del Chat con Lumi.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">6. Propiedad intelectual</h2>
        <p>
          Todo el contenido de SocialMind —incluyendo textos, ilustraciones, el personaje Lumi, la
          estructura de los módulos y el código de la plataforma— es propiedad de SocialMind y está
          protegido por las leyes de propiedad intelectual aplicables. Todos los derechos están
          reservados.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">7. Suspensión o cierre de cuentas</h2>
        <p>
          SocialMind se reserva el derecho de suspender o cerrar cuentas que incumplan estos Términos,
          incluyendo el uso indebido descrito en la sección 3, sin perjuicio de otras acciones legales
          que puedan corresponder.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">8. Limitación de responsabilidad</h2>
        <p>
          SocialMind se ofrece "tal cual", sin garantías de disponibilidad ininterrumpida. En la medida
          permitida por la ley, SocialMind no será responsable por daños indirectos derivados del uso de
          la plataforma.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">9. Cambios a estos Términos</h2>
        <p>
          Estos Términos pueden actualizarse periódicamente. Los cambios relevantes se indicarán con una
          nueva fecha de "última actualización" en esta página.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">10. Contacto</h2>
        <p>
          Para preguntas sobre estos Términos, puedes escribir a soporte de SocialMind a través de los
          medios de contacto indicados en la plataforma.
        </p>
      </section>

      <p className="text-xs text-text-secondary italic border-t border-calm-border pt-4">
        Este documento es un borrador razonable y no constituye asesoría legal formal. Se recomienda
        revisión por un profesional del derecho antes de considerarlo definitivo.
      </p>
    </LegalDocument>
  )
}
```

- [ ] **Step 5: Create `PrivacidadPage.jsx`**

Create `frontend/src/pages/PrivacidadPage.jsx`:

```jsx
import { LegalDocument } from '../components/layout/LegalDocument'

export function PrivacidadPage() {
  return (
    <LegalDocument title="Política de Privacidad" updatedLabel="Última actualización: 21 de julio de 2026">
      <section>
        <h2 className="font-bold text-primary-700 mb-1">1. Qué datos recopilamos</h2>
        <p>
          Recopilamos los datos de la cuenta del adulto responsable (nombre, correo electrónico,
          contraseña cifrada) y los datos del perfil del niño o niña creado por ese adulto (nombre, edad,
          avatar elegido). También registramos la actividad dentro de la plataforma: emociones
          seleccionadas, escenarios completados, conversaciones con Lumi, pausas de la Zona de calma y
          progreso general.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">2. Para qué usamos estos datos</h2>
        <p>
          Usamos estos datos exclusivamente para brindar el servicio: mostrar el progreso del niño o niña,
          permitir el seguimiento pedagógico del especialista vinculado por el padre/madre, y mejorar la
          plataforma. Nunca usamos estos datos con fines publicitarios ni los vendemos a terceros.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">3. Con quién se comparten</h2>
        <p>
          Los datos de un niño o niña solo son visibles para el padre/madre/tutor que gestiona su cuenta
          y para el especialista que ese adulto vincule explícitamente al perfil. También trabajamos con
          proveedores de infraestructura y de inteligencia artificial necesarios para operar la plataforma
          (alojamiento del servidor y generación de respuestas de Lumi), quienes procesan los datos bajo
          sus propias condiciones de confidencialidad. No cedemos ni vendemos datos a terceros con fines
          comerciales.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">4. Seguridad</h2>
        <p>
          Las contraseñas se almacenan cifradas y nunca en texto plano. El acceso a los datos dentro de la
          plataforma está restringido según el rol de cada cuenta (padre, especialista, administrador).
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">5. Tus derechos</h2>
        <p>
          Como adulto responsable de una cuenta, puedes solicitar en cualquier momento el acceso, la
          corrección o la eliminación de los datos de tu hijo/a, escribiendo a través de los medios de
          contacto indicados en la plataforma.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">6. Retención y eliminación</h2>
        <p>
          Conservamos los datos mientras la cuenta permanezca activa. Si solicitas la eliminación de tu
          cuenta, eliminaremos los datos asociados salvo que la ley exija conservarlos por un periodo
          adicional.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">7. Almacenamiento en tu dispositivo</h2>
        <p>
          Para mantener tu sesión iniciada, SocialMind guarda tu token de acceso y datos básicos de tu
          cuenta en el almacenamiento local (localStorage) de tu navegador. Esta información no se
          comparte con terceros ni se usa con fines de rastreo publicitario, y se elimina automáticamente
          al cerrar sesión.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-primary-700 mb-1">8. Contacto</h2>
        <p>
          Para ejercer tus derechos de privacidad o resolver dudas sobre esta política, puedes escribir a
          través de los medios de contacto indicados en la plataforma.
        </p>
      </section>

      <p className="text-xs text-text-secondary italic border-t border-calm-border pt-4">
        Este documento es un borrador razonable y no constituye asesoría legal formal. Se recomienda
        revisión por un profesional del derecho antes de considerarlo definitivo.
      </p>
    </LegalDocument>
  )
}
```

- [ ] **Step 6: Register the routes**

In `frontend/src/router/index.jsx`, add the imports next to the other page imports:

```jsx
import { TerminosPage } from '../pages/TerminosPage'
import { PrivacidadPage } from '../pages/PrivacidadPage'
```

And add the routes next to the other public routes (after the `/reset-password` entry):

```jsx
  { path: '/reset-password',  element: <ResetPasswordPage /> },
  { path: '/terminos',   element: <TerminosPage /> },
  { path: '/privacidad', element: <PrivacidadPage /> },
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/test/LegalPages.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/layout/LegalDocument.jsx frontend/src/pages/TerminosPage.jsx frontend/src/pages/PrivacidadPage.jsx frontend/src/router/index.jsx frontend/src/test/LegalPages.test.jsx
git commit -m "feat: add Términos y Condiciones and Política de Privacidad pages"
```

---

## Task 3: Frontend — legal footer on public pages

**Files:**
- Create: `frontend/src/components/layout/LegalFooter.jsx`
- Modify: `frontend/src/pages/Welcome.jsx`
- Modify: `frontend/src/pages/Login.jsx`
- Modify: `frontend/src/pages/Register.jsx`
- Create: `frontend/src/test/LegalFooter.test.jsx`

**Interfaces:**
- Consumes: routes `/terminos` and `/privacidad` from Task 2.
- Produces: named export `LegalFooter` from `components/layout/LegalFooter.jsx`, rendered on `Welcome`, `Login`, and `Register`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/test/LegalFooter.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LegalFooter } from '../components/layout/LegalFooter'

describe('LegalFooter', () => {
  it('enlaza a /terminos y /privacidad', () => {
    render(<MemoryRouter><LegalFooter /></MemoryRouter>)
    expect(screen.getByRole('link', { name: /Términos y Condiciones/i })).toHaveAttribute('href', '/terminos')
    expect(screen.getByRole('link', { name: /Política de Privacidad/i })).toHaveAttribute('href', '/privacidad')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/test/LegalFooter.test.jsx`
Expected: FAIL — `Failed to resolve import "../components/layout/LegalFooter"`.

- [ ] **Step 3: Create `LegalFooter.jsx`**

Create `frontend/src/components/layout/LegalFooter.jsx`:

```jsx
import { Link } from 'react-router-dom'

export function LegalFooter() {
  return (
    <footer className="flex items-center justify-center gap-3 text-xs text-text-secondary mt-6">
      <Link to="/terminos" className="hover:underline">Términos y Condiciones</Link>
      <span aria-hidden="true">·</span>
      <Link to="/privacidad" className="hover:underline">Política de Privacidad</Link>
    </footer>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/test/LegalFooter.test.jsx`
Expected: PASS.

- [ ] **Step 5: Add the footer to `Welcome.jsx`**

In `frontend/src/pages/Welcome.jsx`, add the import:

```jsx
import { LegalFooter } from '../components/layout/LegalFooter'
```

And add `<LegalFooter />` as the last child inside the `max-w-md` wrapper `div`, right after the closing `</motion.div>` of the buttons block (before the final `</div>` that closes `className="max-w-md w-full flex flex-col items-center gap-8 text-center"`):

```jsx
        </motion.div>

        <LegalFooter />

      </div>
```

- [ ] **Step 6: Add the footer to `Login.jsx`**

In `frontend/src/pages/Login.jsx`, add the import:

```jsx
import { LegalFooter } from '../components/layout/LegalFooter'
```

And add `<LegalFooter />` right after the closing `</Card>` tag, still inside the `max-w-md` wrapper `div`:

```jsx
        </Card>

        <LegalFooter />

      </div>
```

- [ ] **Step 7: Add the footer to `Register.jsx`**

In `frontend/src/pages/Register.jsx`, add the import:

```jsx
import { LegalFooter } from '../components/layout/LegalFooter'
```

And add `<LegalFooter />` right after the closing `</Card>` tag, still inside the `max-w-md` wrapper `div` (this is the same insertion point Task 4 will later add form content to, inside the `Card` — the footer sits outside the `Card`, so the two changes don't overlap):

```jsx
        </Card>

        <LegalFooter />

      </div>
```

- [ ] **Step 8: Run the full frontend test suite to check for regressions**

Run: `cd frontend && npx vitest run`
Expected: all tests PASS, including the pre-existing `WelcomePage.test.jsx` (Welcome and WelcomePage are different components — confirm no naming collision breaks anything).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/layout/LegalFooter.jsx frontend/src/pages/Welcome.jsx frontend/src/pages/Login.jsx frontend/src/pages/Register.jsx frontend/src/test/LegalFooter.test.jsx
git commit -m "feat: add legal footer links to Welcome, Login, and Register pages"
```

---

## Task 4: Frontend — registration checkbox gate

**Files:**
- Modify: `frontend/src/pages/Register.jsx`
- Create: `frontend/src/test/Register.test.jsx`

**Interfaces:**
- Consumes: routes `/terminos` and `/privacidad` from Task 2; backend contract `terms_accepted: boolean` from Task 1.
- Produces: `Register.jsx` submit button disabled until the checkbox is checked; calls `register({ ...form, terms_accepted: true })` on submit.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/test/Register.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Register } from '../pages/Register'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockRegister = vi.fn().mockResolvedValue({ id: 1, role: 'parent', full_name: 'Ana García' })
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ register: mockRegister }),
}))

function renderPage() {
  return render(<MemoryRouter><Register /></MemoryRouter>)
}

describe('Register', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockRegister.mockClear()
  })

  it('el botón de crear cuenta está deshabilitado hasta aceptar los términos', async () => {
    renderPage()
    const submitButton = screen.getByRole('button', { name: /crear mi cuenta/i })
    expect(submitButton).toBeDisabled()

    await userEvent.click(screen.getByRole('checkbox'))
    expect(submitButton).not.toBeDisabled()
  })

  it('envía terms_accepted: true al registrar', async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText(/tu nombre completo/i), 'Ana García')
    await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'ana@example.com')
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'Password123')
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: /crear mi cuenta/i }))

    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({ terms_accepted: true })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/test/Register.test.jsx`
Expected: FAIL — the submit button is not disabled by default (no `termsAccepted` state exists yet), so the first assertion fails.

- [ ] **Step 3: Add the checkbox state and gating to `Register.jsx`**

In `frontend/src/pages/Register.jsx`, change the state declaration:

```jsx
  const [form, setForm]   = useState({ email: '', password: '', full_name: '', role: 'parent' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
```

to:

```jsx
  const [form, setForm]   = useState({ email: '', password: '', full_name: '', role: 'parent' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
```

Change the `handleSubmit` call to `register`:

```jsx
      await register(form)
```

to:

```jsx
      await register({ ...form, terms_accepted: termsAccepted })
```

Add the checkbox block right before the error message block, and update the submit button's `disabled` prop:

```jsx
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
```

to:

```jsx
              <label className="flex items-start gap-3 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="accent-primary-500 w-5 h-5 mt-0.5 shrink-0"
                />
                <span>
                  Acepto los{' '}
                  <Link to="/terminos" target="_blank" rel="noopener noreferrer" className="text-primary-600 font-semibold underline">
                    Términos y Condiciones
                  </Link>{' '}
                  y la{' '}
                  <Link to="/privacidad" target="_blank" rel="noopener noreferrer" className="text-primary-600 font-semibold underline">
                    Política de Privacidad
                  </Link>.
                </span>
              </label>

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

              <Button type="submit" disabled={loading || !termsAccepted} className="w-full mt-2">
                {loading ? 'Creando cuenta...' : 'Crear mi cuenta'}
              </Button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/test/Register.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full frontend test suite to check for regressions**

Run: `cd frontend && npx vitest run`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Register.jsx frontend/src/test/Register.test.jsx
git commit -m "feat: require terms acceptance checkbox on registration form"
```

---

## Manual Verification (after all tasks)

- [ ] Run `docker compose up -d --build backend frontend` locally (or the dev equivalent) and confirm the backend starts cleanly with `alembic upgrade head` applying the new migration without errors.
- [ ] In the browser: visit `/`, `/login`, and `/registro` — confirm the "Términos y Condiciones · Política de Privacidad" footer appears and both links open the correct pages.
- [ ] On `/registro`, confirm "Crear mi cuenta" is disabled until the checkbox is checked, then complete a real registration and confirm it succeeds.
- [ ] Query the database (or use an admin view) to confirm the newly created user has a non-null `terms_accepted_at`.
