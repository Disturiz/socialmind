# SocialMind Etapa 6 — Biblioteca Educativa RAG: Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una biblioteca de PDFs educativos que los especialistas pueden subir, y que Lumi consulta automáticamente durante el chat mediante tool use multi-turno con OpenAI embeddings + cosine similarity.

**Architecture:** Tres subsistemas: (1) capa de datos (modelos `Document` + `DocumentChunk`, embeddings como JSON Text); (2) API REST de gestión de biblioteca con pipeline sincrónico pdfplumber → chunks → OpenAI embeddings; (3) modificación de `chat_service.py` para que `_call_anthropic` incluya un loop multi-turno que maneja la herramienta `search_library`. El frontend agrega la página `Biblioteca.jsx` bajo `SpecialistRoute` y una segunda tarjeta especialista en el Dashboard.

**Tech Stack:** FastAPI · SQLAlchemy 2.0 · pdfplumber · openai (Python SDK) · numpy · React · Vitest · Testing Library · Framer Motion · Tailwind CSS

## Global Constraints

- Todo texto visible al usuario: mínimo `text-base` (Tailwind)
- Elementos interactivos: `min-h-[44px]`
- Colores Tailwind: solo clases estáticas (nunca concatenación dinámica)
- Idioma: solo español latinoamericano en toda interfaz visible
- Sin lenguaje clínico, médico ni diagnóstico en etiquetas o mensajes
- `OPENAI_API_KEY`: solo en `.env` backend, nunca en código ni frontend
- `ANTHROPIC_API_KEY`: solo en `.env` backend, nunca en código ni frontend
- Sin `window.confirm` en el frontend: confirmación inline en componente
- Backend tests: SQLite in-memory via conftest.py (StaticPool); nunca PostgreSQL en tests
- El niño nunca escribe texto libre — solo selecciona botones

---

## Mapa de archivos

```
# Nuevos
backend/app/models/document.py
backend/app/models/document_chunk.py
backend/alembic/versions/<rev>_add_biblioteca.py
backend/app/schemas/biblioteca.py
backend/app/services/biblioteca_service.py
backend/app/routers/biblioteca.py
backend/tests/test_biblioteca.py
frontend/src/pages/Biblioteca.jsx
frontend/src/test/Biblioteca.test.jsx

# Modificados
backend/requirements.txt                  (+ openai, pdfplumber, numpy)
backend/app/config.py                     (+ openai_api_key)
backend/app/models/__init__.py            (+ Document, DocumentChunk)
backend/app/main.py                       (+ import models, include router)
backend/app/services/chat_service.py     (SEARCH_TOOL, loop multi-turno, db param)
backend/tests/test_chat.py               (+ 2 tests RAG + fix _make_anthropic_mock)
frontend/src/services/api.js             (+ bibliotecaApi)
frontend/src/router/index.jsx            (+ ruta /biblioteca con SpecialistRoute)
frontend/src/pages/Dashboard.jsx         (SPECIALIST_CARD → SPECIALIST_CARDS array)
```

---

## Task 1: Backend — Modelos + Config + Migración Alembic

**Files:**
- Create: `backend/app/models/document.py`
- Create: `backend/app/models/document_chunk.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/config.py`
- Modify: `backend/requirements.txt`
- Create: `backend/alembic/versions/<rev>_add_biblioteca.py`
- Test: inline via pytest (verifica que las tablas existen en SQLite)

**Interfaces:**
- Produces: clase `Document` con atributos `id, specialist_id, filename, original_name, file_size_bytes, status, chunk_count, created_at`; clase `DocumentChunk` con `id, document_id, chunk_index, content, embedding, created_at`

- [ ] **Step 1: Agregar dependencias a requirements.txt**

En `backend/requirements.txt`, agregar al final:
```
openai==1.35.7
pdfplumber==0.11.0
numpy==1.26.4
```

- [ ] **Step 2: Agregar `openai_api_key` a config.py**

Abrir `backend/app/config.py`. Agregar el campo después de `anthropic_api_key`:
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

    class Config:
        env_file = ".env"

settings = Settings()
```

- [ ] **Step 3: Crear el modelo Document**

Crear `backend/app/models/document.py`:
```python
from datetime import datetime
from sqlalchemy import Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    specialist_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
```

- [ ] **Step 4: Crear el modelo DocumentChunk**

Crear `backend/app/models/document_chunk.py`:
```python
from datetime import datetime
from sqlalchemy import Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
```

- [ ] **Step 5: Actualizar models/__init__.py**

En `backend/app/models/__init__.py`, agregar las dos importaciones y __all__:
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

__all__ = [
    "User", "UserRole", "ChildProfile",
    "EmotionLog", "ScenarioCompletion",
    "ChatConversation", "ChatMessage",
    "CalmSession", "SpecialistNote",
    "Document", "DocumentChunk",
]
```

- [ ] **Step 6: Actualizar main.py con imports y router placeholder**

En `backend/app/main.py`, agregar los dos imports de modelo. El archivo completo queda así:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, emotions, scenarios, chat, calm, panel
import app.models.user
import app.models.child_profile
import app.models.emotion_log
import app.models.scenario_completion
import app.models.chat_conversation
import app.models.chat_message
import app.models.calm_session
import app.models.specialist_note
import app.models.document
import app.models.document_chunk

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

app.include_router(auth.router,      prefix="/api/v1/auth",      tags=["autenticación"])
app.include_router(emotions.router,  prefix="/api/v1/emotions",  tags=["emociones"])
app.include_router(scenarios.router, prefix="/api/v1/scenarios", tags=["escenarios"])
app.include_router(chat.router,      prefix="/api/v1/chat",      tags=["chat"])
app.include_router(calm.router,      prefix="/api/v1/calma",     tags=["calma"])
app.include_router(panel.router,     prefix="/api/v1/panel",     tags=["panel"])


@app.get("/health", tags=["sistema"])
def health_check():
    return {"status": "ok", "service": "socialmind-api"}
```

(El router de biblioteca se agrega en Task 2.)

- [ ] **Step 7: Instalar las nuevas dependencias**

Dentro de `backend/` (donde está el virtualenv activo):
```bash
pip install openai==1.35.7 pdfplumber==0.11.0 numpy==1.26.4
```
Salida esperada: `Successfully installed openai-1.35.7 pdfplumber-0.11.0 numpy-1.26.4 ...`

- [ ] **Step 8: Escribir test de verificación de tablas**

Crear `backend/tests/test_biblioteca.py` con solo el primer test (el resto se agrega en Task 2):
```python
import pytest
from unittest.mock import MagicMock, patch
import io
from sqlalchemy import text


def _login(client, email, role="specialist"):
    client.post("/api/v1/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Test User", "role": role,
    })
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return resp.json()["access_token"]


def _me(client, token):
    return client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()


def test_document_tables_exist(db):
    result = db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'"))
    assert result.fetchone() is not None, "Tabla 'documents' no existe"
    result = db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='document_chunks'"))
    assert result.fetchone() is not None, "Tabla 'document_chunks' no existe"
```

- [ ] **Step 9: Ejecutar el test**

```bash
cd backend
pytest tests/test_biblioteca.py::test_document_tables_exist -v
```
Salida esperada:
```
PASSED tests/test_biblioteca.py::test_document_tables_exist
```

- [ ] **Step 10: Generar migración Alembic**

Desde `backend/`, con la DB de desarrollo (PostgreSQL) configurada en `.env`:
```bash
alembic revision --autogenerate -m "add_biblioteca"
```

Revisar el archivo generado en `backend/alembic/versions/`. Verificar que incluye `create_table('documents', ...)` y `create_table('document_chunks', ...)`. El archivo debe verse así (el revision ID varía):

```python
"""add_biblioteca

Revision ID: <rev_generado>
Revises: 002ff0a67c99
Create Date: 2026-06-17 ...

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '<rev_generado>'
down_revision: Union[str, None] = '002ff0a67c99'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('documents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('specialist_id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('original_name', sa.String(length=255), nullable=False),
        sa.Column('file_size_bytes', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('chunk_count', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['specialist_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_documents_id'), 'documents', ['id'], unique=False)
    op.create_table('document_chunks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('embedding', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_document_chunks_id'), 'document_chunks', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_document_chunks_id'), table_name='document_chunks')
    op.drop_table('document_chunks')
    op.drop_index(op.f('ix_documents_id'), table_name='documents')
    op.drop_table('documents')
```

Si autogenerate detecta tablas extra (de migraciones anteriores mal registradas), eliminar esas líneas del archivo generado y dejar solo las de `documents` y `document_chunks`.

- [ ] **Step 11: Aplicar migración**

```bash
alembic upgrade head
```
Salida esperada: `Running upgrade 002ff0a67c99 -> <rev>, add_biblioteca`

- [ ] **Step 12: Commit**

```bash
git add backend/requirements.txt backend/app/config.py \
        backend/app/models/document.py backend/app/models/document_chunk.py \
        backend/app/models/__init__.py backend/app/main.py \
        backend/alembic/versions/ backend/tests/test_biblioteca.py
git commit -m "feat: modelos Document/DocumentChunk, config openai_api_key, migración Alembic"
```

---

## Task 2: Backend — Biblioteca Service + Router + Tests

**Files:**
- Create: `backend/app/schemas/biblioteca.py`
- Create: `backend/app/services/biblioteca_service.py`
- Create: `backend/app/routers/biblioteca.py`
- Modify: `backend/app/main.py` (incluir router biblioteca)
- Modify: `backend/tests/test_biblioteca.py` (agregar 6 tests)

**Interfaces:**
- Consumes (de Task 1): `Document`, `DocumentChunk` (modelos), `require_specialist` y `get_current_user` (de `app.core.dependencies`), `settings.openai_api_key`
- Produces:
  - `biblioteca_service.upload_and_process(db, specialist_id, file_bytes, original_name, file_size) -> Document`
  - `biblioteca_service.list_documents(db) -> list[Document]`
  - `biblioteca_service.delete_document(db, specialist_id, doc_id) -> None`
  - `biblioteca_service.search(db, query, top_k=3) -> str`
  - `openai_client` — singleton patcheable en tests: `patch("app.services.biblioteca_service.openai_client")`
  - `DATA_DIR` — string patcheable en tests: `monkeypatch.setattr(bs, "DATA_DIR", str(tmp_path))`
  - Endpoints: `POST /api/v1/biblioteca/upload` (201), `GET /api/v1/biblioteca/documents` (200), `DELETE /api/v1/biblioteca/documents/{doc_id}` (204)

- [ ] **Step 1: Escribir los 6 tests restantes en test_biblioteca.py (modo TDD)**

Agregar al final de `backend/tests/test_biblioteca.py`:
```python
def test_upload_document_creates_record_and_chunks(client, db, tmp_path, monkeypatch):
    import app.services.biblioteca_service as bs
    monkeypatch.setattr(bs, "DATA_DIR", str(tmp_path))

    token = _login(client, "spec_upload@test.com")

    mock_page = MagicMock()
    mock_page.extract_text.return_value = "Texto sobre autismo y regulación emocional en niños. " * 20

    mock_embedding_data = MagicMock()
    mock_embedding_data.embedding = [0.1] * 1536

    with patch("pdfplumber.open") as mock_pdfplumber, \
         patch("app.services.biblioteca_service.openai_client") as mock_openai:
        mock_pdfplumber.return_value.__enter__ = MagicMock(
            return_value=MagicMock(pages=[mock_page])
        )
        mock_pdfplumber.return_value.__exit__ = MagicMock(return_value=False)
        mock_openai.embeddings.create.return_value = MagicMock(
            data=[mock_embedding_data]
        )

        files = {"file": ("guia.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")}
        response = client.post(
            "/api/v1/biblioteca/upload",
            files=files,
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 201
    data = response.json()
    assert data["original_name"] == "guia.pdf"
    assert data["status"] == "ready"
    assert data["chunk_count"] >= 1


def test_upload_document_non_pdf_returns_422(client):
    token = _login(client, "spec_nonpdf@test.com")
    files = {"file": ("imagen.jpg", io.BytesIO(b"fake jpg"), "image/jpeg")}
    response = client.post(
        "/api/v1/biblioteca/upload",
        files=files,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def test_upload_document_too_large_returns_413(client, tmp_path, monkeypatch):
    import app.services.biblioteca_service as bs
    monkeypatch.setattr(bs, "DATA_DIR", str(tmp_path))

    token = _login(client, "spec_toolarge@test.com")
    large_bytes = b"X" * (10 * 1024 * 1024 + 1)
    files = {"file": ("big.pdf", io.BytesIO(large_bytes), "application/pdf")}
    response = client.post(
        "/api/v1/biblioteca/upload",
        files=files,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 413


def test_upload_document_parent_role_returns_403(client):
    token = _login(client, "parent_noupload@test.com", role="parent")
    files = {"file": ("doc.pdf", io.BytesIO(b"%PDF fake"), "application/pdf")}
    response = client.post(
        "/api/v1/biblioteca/upload",
        files=files,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


def test_list_documents_returns_all_documents(client, db):
    spec_token = _login(client, "spec_list@test.com")
    parent_token = _login(client, "parent_list@test.com", role="parent")
    spec_id = _me(client, spec_token)["id"]

    from datetime import datetime, timezone
    from app.models.document import Document
    for name in ["doc1.pdf", "doc2.pdf"]:
        db.add(Document(
            specialist_id=spec_id,
            filename=name,
            original_name=name,
            file_size_bytes=100,
            status="ready",
            chunk_count=3,
            created_at=datetime.now(timezone.utc),
        ))
    db.commit()

    for token in [spec_token, parent_token]:
        response = client.get(
            "/api/v1/biblioteca/documents",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert len(response.json()) == 2


def test_delete_document_removes_record_and_file(client, db, tmp_path, monkeypatch):
    import app.services.biblioteca_service as bs
    monkeypatch.setattr(bs, "DATA_DIR", str(tmp_path))

    token = _login(client, "spec_del@test.com")
    spec_id = _me(client, token)["id"]

    filename = "to_delete.pdf"
    file_path = tmp_path / filename
    file_path.write_bytes(b"fake pdf content")

    from datetime import datetime, timezone
    from app.models.document import Document
    doc = Document(
        specialist_id=spec_id,
        filename=filename,
        original_name="to_delete.pdf",
        file_size_bytes=16,
        status="ready",
        chunk_count=0,
        created_at=datetime.now(timezone.utc),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    response = client.delete(
        f"/api/v1/biblioteca/documents/{doc.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 204
    assert not file_path.exists()
    assert db.query(Document).filter(Document.id == doc.id).first() is None


def test_delete_document_other_specialist_returns_404(client, db, tmp_path, monkeypatch):
    import app.services.biblioteca_service as bs
    monkeypatch.setattr(bs, "DATA_DIR", str(tmp_path))

    owner_token = _login(client, "spec_owner@test.com")
    other_token = _login(client, "spec_other@test.com")
    owner_id = _me(client, owner_token)["id"]

    from datetime import datetime, timezone
    from app.models.document import Document
    doc = Document(
        specialist_id=owner_id,
        filename="owner_doc.pdf",
        original_name="owner_doc.pdf",
        file_size_bytes=100,
        status="ready",
        chunk_count=0,
        created_at=datetime.now(timezone.utc),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    response = client.delete(
        f"/api/v1/biblioteca/documents/{doc.id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert response.status_code == 404
```

- [ ] **Step 2: Ejecutar tests para verificar que fallan (sin implementación)**

```bash
cd backend
pytest tests/test_biblioteca.py -v --tb=short
```
Salida esperada: `test_document_tables_exist PASSED`, los demás `ERROR` o `FAILED` (router 404 o ImportError).

- [ ] **Step 3: Crear schemas/biblioteca.py**

Crear `backend/app/schemas/biblioteca.py`:
```python
from datetime import datetime
from pydantic import BaseModel


class DocumentOut(BaseModel):
    id: int
    original_name: str
    file_size_bytes: int
    status: str
    chunk_count: int
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Crear services/biblioteca_service.py**

Crear `backend/app/services/biblioteca_service.py`:
```python
import json
import os
import re
import uuid
from datetime import datetime, timezone

import numpy as np
import openai
import pdfplumber
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models.document import Document
from app.models.document_chunk import DocumentChunk

DATA_DIR = os.environ.get("BIBLIOTECA_DATA_DIR", "/data/biblioteca")

# Singleton patcheable en tests via:
# patch("app.services.biblioteca_service.openai_client", mock_openai)
openai_client = openai.OpenAI(api_key=settings.openai_api_key)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
CHUNK_MAX_WORDS = 400
CHUNK_OVERLAP_WORDS = 40


def _extract_text(file_path: str) -> str:
    with pdfplumber.open(file_path) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n\n".join(pages)


def _chunk_text(text: str) -> list[str]:
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    current: list[str] = []

    def flush():
        if current:
            chunks.append(" ".join(current))

    for para in paragraphs:
        words = para.split()
        if len(current) + len(words) <= CHUNK_MAX_WORDS:
            current.extend(words)
        else:
            flush()
            overlap = current[-CHUNK_OVERLAP_WORDS:] if current else []
            if len(words) <= CHUNK_MAX_WORDS:
                current = overlap + words
            else:
                # párrafo largo: dividir por oraciones
                current = overlap
                for sent in re.split(r"(?<=[.!?])\s+", para):
                    sent_words = sent.split()
                    if len(current) + len(sent_words) <= CHUNK_MAX_WORDS:
                        current.extend(sent_words)
                    else:
                        flush()
                        current = current[-CHUNK_OVERLAP_WORDS:] + sent_words

    flush()
    return [c for c in chunks if c.strip()]


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)


def upload_and_process(
    db: Session,
    specialist_id: int,
    file_bytes: bytes,
    original_name: str,
    file_size: int,
) -> Document:
    os.makedirs(DATA_DIR, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.pdf"
    file_path = os.path.join(DATA_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    doc = Document(
        specialist_id=specialist_id,
        filename=filename,
        original_name=original_name,
        file_size_bytes=file_size,
        status="processing",
        chunk_count=0,
        created_at=datetime.now(timezone.utc),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    try:
        text = _extract_text(file_path)
        chunks = _chunk_text(text)

        for i, chunk_content in enumerate(chunks):
            resp = openai_client.embeddings.create(
                model="text-embedding-3-small",
                input=chunk_content,
            )
            embedding = resp.data[0].embedding
            db.add(DocumentChunk(
                document_id=doc.id,
                chunk_index=i,
                content=chunk_content,
                embedding=json.dumps(embedding),
                created_at=datetime.now(timezone.utc),
            ))

        doc.status = "ready"
        doc.chunk_count = len(chunks)
        db.commit()
        db.refresh(doc)
        return doc

    except Exception:
        doc.status = "failed"
        db.commit()
        raise


def list_documents(db: Session) -> list[Document]:
    return db.query(Document).order_by(Document.created_at.desc()).all()


def delete_document(db: Session, specialist_id: int, doc_id: int) -> None:
    doc = (
        db.query(Document)
        .filter(Document.id == doc_id, Document.specialist_id == specialist_id)
        .first()
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento no encontrado.",
        )

    file_path = os.path.join(DATA_DIR, doc.filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    db.delete(doc)
    db.commit()


def search(db: Session, query: str, top_k: int = 3) -> str:
    chunks = (
        db.query(DocumentChunk)
        .join(Document, DocumentChunk.document_id == Document.id)
        .filter(Document.status == "ready")
        .all()
    )
    if not chunks:
        return ""

    query_resp = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=query,
    )
    query_emb = query_resp.data[0].embedding

    scored = []
    for chunk in chunks:
        chunk_emb = json.loads(chunk.embedding)
        sim = _cosine_similarity(query_emb, chunk_emb)
        scored.append((sim, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:top_k]

    parts = []
    for i, (_, chunk) in enumerate(top, 1):
        doc = db.query(Document).filter(Document.id == chunk.document_id).first()
        doc_name = doc.original_name if doc else "documento"
        parts.append(f'[Fragmento {i} de "{doc_name}"]:\n{chunk.content}')

    return "\n\n".join(parts)
```

- [ ] **Step 5: Crear routers/biblioteca.py**

Crear `backend/app/routers/biblioteca.py`:
```python
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_specialist
from app.database import get_db
from app.models.user import User
from app.schemas.biblioteca import DocumentOut
from app.services import biblioteca_service

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

router = APIRouter()


@router.post("/upload", response_model=DocumentOut, status_code=201)
def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(require_specialist),
    db: Session = Depends(get_db),
):
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Solo se permiten archivos PDF.",
        )
    file_bytes = file.file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="El archivo excede el tamaño máximo de 10 MB.",
        )
    return biblioteca_service.upload_and_process(
        db=db,
        specialist_id=current_user.id,
        file_bytes=file_bytes,
        original_name=file.filename,
        file_size=len(file_bytes),
    )


@router.get("/documents", response_model=list[DocumentOut])
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return biblioteca_service.list_documents(db)


@router.delete("/documents/{doc_id}", status_code=204)
def delete_document(
    doc_id: int,
    current_user: User = Depends(require_specialist),
    db: Session = Depends(get_db),
):
    biblioteca_service.delete_document(db, current_user.id, doc_id)
```

- [ ] **Step 6: Registrar el router en main.py**

En `backend/app/main.py`, agregar la importación del router y el `include_router`. El archivo queda:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, emotions, scenarios, chat, calm, panel, biblioteca
import app.models.user
import app.models.child_profile
import app.models.emotion_log
import app.models.scenario_completion
import app.models.chat_conversation
import app.models.chat_message
import app.models.calm_session
import app.models.specialist_note
import app.models.document
import app.models.document_chunk

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

app.include_router(auth.router,       prefix="/api/v1/auth",       tags=["autenticación"])
app.include_router(emotions.router,   prefix="/api/v1/emotions",   tags=["emociones"])
app.include_router(scenarios.router,  prefix="/api/v1/scenarios",  tags=["escenarios"])
app.include_router(chat.router,       prefix="/api/v1/chat",       tags=["chat"])
app.include_router(calm.router,       prefix="/api/v1/calma",      tags=["calma"])
app.include_router(panel.router,      prefix="/api/v1/panel",      tags=["panel"])
app.include_router(biblioteca.router, prefix="/api/v1/biblioteca", tags=["biblioteca"])


@app.get("/health", tags=["sistema"])
def health_check():
    return {"status": "ok", "service": "socialmind-api"}
```

- [ ] **Step 7: Ejecutar todos los tests de biblioteca**

```bash
cd backend
pytest tests/test_biblioteca.py -v
```
Salida esperada: los 7 tests pasan.
```
PASSED tests/test_biblioteca.py::test_document_tables_exist
PASSED tests/test_biblioteca.py::test_upload_document_creates_record_and_chunks
PASSED tests/test_biblioteca.py::test_upload_document_non_pdf_returns_422
PASSED tests/test_biblioteca.py::test_upload_document_too_large_returns_413
PASSED tests/test_biblioteca.py::test_upload_document_parent_role_returns_403
PASSED tests/test_biblioteca.py::test_list_documents_returns_all_documents
PASSED tests/test_biblioteca.py::test_delete_document_removes_record_and_file
PASSED tests/test_biblioteca.py::test_delete_document_other_specialist_returns_404
```

- [ ] **Step 8: Verificar suite completa no está rota**

```bash
pytest --tb=short -q
```
Salida esperada: todos los tests pasan (ninguno regresiona).

- [ ] **Step 9: Commit**

```bash
git add backend/app/schemas/biblioteca.py \
        backend/app/services/biblioteca_service.py \
        backend/app/routers/biblioteca.py \
        backend/app/main.py \
        backend/tests/test_biblioteca.py
git commit -m "feat: biblioteca service, router y tests — upload/list/delete PDFs con embeddings"
```

---

## Task 3: Backend — Integración RAG en chat_service.py

**Files:**
- Modify: `backend/app/services/chat_service.py`
- Modify: `backend/tests/test_chat.py`

**Interfaces:**
- Consumes (de Task 2): `biblioteca_service.search(db, query, top_k=3) -> str`; `DATA_DIR`, `openai_client` del service (no se usan aquí directamente)
- Produces: `_call_anthropic(emotion_key, db_messages, db)` — nueva firma con tercer parámetro `db: Session`

**Nota crítica:** Al cambiar `tool_choice` a `{"type": "auto"}` y añadir la búsqueda por nombre, el helper `_make_anthropic_mock` en `test_chat.py` debe recibir `mock_tool.name = "respond_to_child"`. Sin esto, todos los tests de chat existentes regresan al FALLBACK_RESPONSE.

- [ ] **Step 1: Escribir los 2 tests nuevos en test_chat.py (TDD)**

Agregar al final de `backend/tests/test_chat.py`:
```python
def test_chat_search_library_injects_context(client, db):
    token = _register_and_login(client, "rag_search@test.com")

    search_block = MagicMock()
    search_block.type = "tool_use"
    search_block.name = "search_library"
    search_block.id = "tu_abc123"
    search_block.input = {"query": "autismo regulacion emocional"}

    search_response = MagicMock()
    search_response.content = [search_block]

    respond_block = MagicMock()
    respond_block.type = "tool_use"
    respond_block.name = "respond_to_child"
    respond_block.input = {
        "message": "Lo que sentís tiene mucho sentido.",
        "options": ["Contame más", "Cambiar tema", "Terminar"],
        "lumi_state": "happy",
    }

    final_response = MagicMock()
    final_response.content = [respond_block]

    with patch("app.services.chat_service.anthropic_client") as mock_anthropic, \
         patch("app.services.chat_service.biblioteca_service") as mock_bs:
        mock_anthropic.messages.create.side_effect = [search_response, final_response]
        mock_bs.search.return_value = "[Fragmento 1]: Texto educativo relevante."

        resp = client.post(
            "/api/v1/chat/start",
            json={"emotion_key": "confundido"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 201
    assert resp.json()["message"] == "Lo que sentís tiene mucho sentido."
    assert mock_anthropic.messages.create.call_count == 2
    mock_bs.search.assert_called_once()


def test_chat_no_search_needed_responds_directly(client, db):
    token = _register_and_login(client, "rag_no_search@test.com")

    respond_block = MagicMock()
    respond_block.type = "tool_use"
    respond_block.name = "respond_to_child"
    respond_block.input = {
        "message": "¡Qué bueno escucharte!",
        "options": ["Gracias", "Contame algo", "Terminar"],
        "lumi_state": "happy",
    }

    direct_response = MagicMock()
    direct_response.content = [respond_block]

    with patch("app.services.chat_service.anthropic_client") as mock_anthropic, \
         patch("app.services.chat_service.biblioteca_service") as mock_bs:
        mock_anthropic.messages.create.return_value = direct_response

        resp = client.post(
            "/api/v1/chat/start",
            json={"emotion_key": "feliz"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 201
    assert resp.json()["message"] == "¡Qué bueno escucharte!"
    assert mock_anthropic.messages.create.call_count == 1
    mock_bs.search.assert_not_called()
```

- [ ] **Step 2: Verificar que los 2 tests nuevos fallan (sin implementación aún)**

```bash
cd backend
pytest tests/test_chat.py::test_chat_search_library_injects_context \
       tests/test_chat.py::test_chat_no_search_needed_responds_directly -v --tb=short
```
Salida esperada: ambos `FAILED`.

- [ ] **Step 3: Reescribir chat_service.py con loop multi-turno**

Reemplazar el contenido completo de `backend/app/services/chat_service.py`:
```python
import anthropic
from datetime import datetime, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.config import settings
from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage
from app.services import biblioteca_service

MAX_MESSAGES = 30

RESPOND_TOOL = {
    "name": "respond_to_child",
    "description": "Responde al niño con un mensaje y opciones de respuesta.",
    "input_schema": {
        "type": "object",
        "properties": {
            "message": {
                "type": "string",
                "description": "Mensaje de Lumi (máx. 3 oraciones cortas)",
            },
            "options": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 3,
                "maxItems": 4,
                "description": "Opciones de respuesta. La última siempre es 'Terminar'.",
            },
            "lumi_state": {
                "type": "string",
                "enum": ["happy", "thinking", "encouraging", "idle"],
            },
        },
        "required": ["message", "options", "lumi_state"],
    },
}

SEARCH_TOOL = {
    "name": "search_library",
    "description": (
        "Busca en la biblioteca educativa cuando el niño menciona algo "
        "sobre lo que querés agregar contexto de los documentos subidos "
        "por especialistas. Solo úsala cuando sea relevante para la conversación."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Texto de búsqueda semántica en la biblioteca",
            }
        },
        "required": ["query"],
    },
}

SYSTEM_PROMPT_TEMPLATE = (
    "Eres Lumi, un búho amigable y paciente que acompaña a niños y adolescentes "
    "(8-17 años) en su aprendizaje social y emocional.\n\n"
    "PERSONALIDAD: cálida, calmada, alentadora. Nunca sarcástica, nunca clínica.\n\n"
    "REGLAS:\n"
    "- Responde siempre en español latinoamericano\n"
    "- Frases cortas y simples (máximo 3 oraciones por mensaje)\n"
    "- Jamás uses términos médicos, diagnósticos ni clínicos\n"
    "- Mantén el tema relacionado a la emoción inicial o lo que el niño elija\n"
    "- Si el niño expresa angustia severa o peligro, responde: "
    "'Eso suena muy importante. ¿Podés contarle a un adulto de confianza cómo te sentís?'\n"
    "- La última opción de respuesta SIEMPRE es 'Terminar'\n"
    "- Usa respond_to_child para cada respuesta. Usa search_library solo si el "
    "contexto de la biblioteca educativa sería útil para el niño.\n\n"
    "CONTEXTO DE HOY: El niño se siente {emotion_key}."
)

FALLBACK_RESPONSE = {
    "message": "Lo siento, hubo un problema técnico. ¿Podés intentarlo de nuevo?",
    "options": ["Reintentar", "Terminar"],
    "lumi_state": "idle",
}

# Singleton — se parchea en tests con unittest.mock.patch
anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)


def _build_messages(emotion_key: str, db_messages: list[ChatMessage]) -> list[dict]:
    msgs: list[dict] = [
        {"role": "user", "content": f"Hola Lumi, hoy me siento {emotion_key}."}
    ]
    for m in db_messages:
        msgs.append({"role": m.role, "content": m.content})
    return msgs


def _call_anthropic(
    emotion_key: str, db_messages: list[ChatMessage], db: Session
) -> dict:
    system = SYSTEM_PROMPT_TEMPLATE.format(emotion_key=emotion_key)
    messages = _build_messages(emotion_key, db_messages)
    max_iterations = 3

    for _ in range(max_iterations):
        response = anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=system,
            tools=[RESPOND_TOOL, SEARCH_TOOL],
            tool_choice={"type": "auto"},
            messages=messages,
        )

        search_use = next(
            (b for b in response.content
             if b.type == "tool_use" and b.name == "search_library"),
            None,
        )
        respond_use = next(
            (b for b in response.content
             if b.type == "tool_use" and b.name == "respond_to_child"),
            None,
        )

        if respond_use:
            return respond_use.input

        if search_use:
            results = biblioteca_service.search(db, search_use.input["query"], top_k=3)
            messages.append({"role": "assistant", "content": response.content})
            messages.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": search_use.id,
                    "content": results,
                }],
            })
        else:
            break

    return FALLBACK_RESPONSE


def start_conversation(db: Session, user_id: int, emotion_key: str) -> dict:
    conv = ChatConversation(user_id=user_id, emotion_key=emotion_key)
    db.add(conv)
    db.flush()

    lumi_resp = _call_anthropic(emotion_key, [], db)

    db.add(ChatMessage(
        conversation_id=conv.id,
        role="assistant",
        content=lumi_resp["message"],
    ))
    db.commit()
    db.refresh(conv)

    return {
        "conversation_id": conv.id,
        "message": lumi_resp["message"],
        "options": lumi_resp["options"],
        "lumi_state": lumi_resp["lumi_state"],
    }


def send_message(db: Session, user_id: int, conversation_id: int, content: str) -> dict:
    conv = (
        db.query(ChatConversation)
        .filter(ChatConversation.id == conversation_id, ChatConversation.user_id == user_id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversación no encontrada.")
    if conv.ended_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La conversación ya terminó.")

    db.add(ChatMessage(conversation_id=conv.id, role="user", content=content))
    db.flush()

    ended = content.strip().lower() == "terminar"

    if ended:
        conv.ended_at = datetime.now(timezone.utc)
        lumi_resp = {
            "message": "¡Fue un gusto conversar con vos! Espero que te haya ayudado. ¡Hasta la próxima!",
            "options": ["Terminar"],
            "lumi_state": "happy",
        }
    else:
        msg_count = (
            db.query(ChatMessage)
            .filter(ChatMessage.conversation_id == conv.id)
            .count()
        )
        if msg_count >= MAX_MESSAGES:
            conv.ended_at = datetime.now(timezone.utc)
            ended = True
            lumi_resp = {
                "message": "Hemos tenido una charla muy buena. ¡Fue genial hablar con vos hoy!",
                "options": ["Terminar"],
                "lumi_state": "happy",
            }
        else:
            history = (
                db.query(ChatMessage)
                .filter(ChatMessage.conversation_id == conv.id)
                .order_by(ChatMessage.created_at)
                .all()
            )
            lumi_resp = _call_anthropic(conv.emotion_key, history, db)

    db.add(ChatMessage(
        conversation_id=conv.id,
        role="assistant",
        content=lumi_resp["message"],
    ))
    db.commit()

    return {
        "message": lumi_resp["message"],
        "options": lumi_resp["options"],
        "lumi_state": lumi_resp["lumi_state"],
        "ended": ended,
    }


def get_history(db: Session, user_id: int) -> list[dict]:
    msg_counts = (
        db.query(
            ChatMessage.conversation_id,
            func.count(ChatMessage.id).label("count"),
        )
        .group_by(ChatMessage.conversation_id)
        .subquery()
    )
    rows = (
        db.query(ChatConversation, msg_counts.c.count)
        .outerjoin(msg_counts, ChatConversation.id == msg_counts.c.conversation_id)
        .filter(ChatConversation.user_id == user_id)
        .order_by(ChatConversation.started_at.desc())
        .limit(10)
        .all()
    )
    return [
        {
            "conversation_id": conv.id,
            "emotion_key": conv.emotion_key,
            "started_at": conv.started_at,
            "ended_at": conv.ended_at,
            "message_count": count or 0,
        }
        for conv, count in rows
    ]


def get_conversation(db: Session, user_id: int, conversation_id: int) -> dict:
    conv = (
        db.query(ChatConversation)
        .filter(ChatConversation.id == conversation_id, ChatConversation.user_id == user_id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversación no encontrada.")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conv.id)
        .order_by(ChatMessage.created_at)
        .all()
    )
    return {
        "conversation_id": conv.id,
        "emotion_key": conv.emotion_key,
        "messages": [
            {"role": m.role, "content": m.content, "created_at": m.created_at}
            for m in messages
        ],
    }
```

- [ ] **Step 4: Corregir el helper `_make_anthropic_mock` en test_chat.py**

En `backend/tests/test_chat.py`, agregar `mock_tool.name = "respond_to_child"` dentro de `_make_anthropic_mock`. La función queda:
```python
def _make_anthropic_mock(message="Hola, ¿cómo estás?", options=None, lumi_state="happy"):
    if options is None:
        options = ["Bien", "Regular", "Quiero hablar", "Terminar"]
    mock_tool = MagicMock()
    mock_tool.type = "tool_use"
    mock_tool.name = "respond_to_child"
    mock_tool.input = {"message": message, "options": options, "lumi_state": lumi_state}
    mock_resp = MagicMock()
    mock_resp.content = [mock_tool]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_resp
    return mock_client
```

- [ ] **Step 5: Ejecutar tests de chat (todos deben pasar)**

```bash
cd backend
pytest tests/test_chat.py -v
```
Salida esperada: los 9 tests originales + 2 nuevos pasan (11 total).
```
PASSED tests/test_chat.py::test_chat_start_creates_conversation_and_returns_lumi_message
PASSED tests/test_chat.py::test_chat_start_passes_emotion_key_to_anthropic
PASSED tests/test_chat.py::test_send_message_saves_both_messages_and_returns_response
PASSED tests/test_chat.py::test_send_message_on_closed_conversation_returns_409
PASSED tests/test_chat.py::test_send_message_on_other_users_conversation_returns_404
PASSED tests/test_chat.py::test_get_history_returns_last_10_conversations
PASSED tests/test_chat.py::test_get_conversation_returns_all_messages
PASSED tests/test_chat.py::test_send_terminar_closes_conversation
PASSED tests/test_chat.py::test_send_message_anthropic_returns_no_tool_use_returns_fallback
PASSED tests/test_chat.py::test_chat_search_library_injects_context
PASSED tests/test_chat.py::test_chat_no_search_needed_responds_directly
```

- [ ] **Step 6: Ejecutar suite completa**

```bash
pytest --tb=short -q
```
Salida esperada: todos los tests pasan.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/chat_service.py backend/tests/test_chat.py
git commit -m "feat: integración RAG en chat — SEARCH_TOOL, loop multi-turno, search_library"
```

---

## Task 4: Frontend — Biblioteca UI + API + Router + Dashboard

**Files:**
- Modify: `frontend/src/services/api.js`
- Create: `frontend/src/pages/Biblioteca.jsx`
- Modify: `frontend/src/router/index.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`
- Create: `frontend/src/test/Biblioteca.test.jsx`

**Interfaces:**
- Consumes: `SpecialistRoute` (ya existe en router/index.jsx), `PageWrapper` (ya existe), `bibliotecaApi.upload/list/delete`
- Produces: página `/biblioteca` para especialistas; `SPECIALIST_CARDS` array en Dashboard (reemplaza `SPECIALIST_CARD` singular)

- [ ] **Step 1: Escribir el test de Biblioteca.test.jsx (TDD)**

Crear `frontend/src/test/Biblioteca.test.jsx`:
```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Biblioteca } from '../pages/Biblioteca'
import { bibliotecaApi } from '../services/api'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../services/api', () => ({
  bibliotecaApi: {
    list:   vi.fn(),
    upload: vi.fn(),
    delete: vi.fn(),
  },
  authApi:      { register: vi.fn(), login: vi.fn(), getMe: vi.fn() },
  emotionsApi:  { list: vi.fn(), log: vi.fn(), today: vi.fn() },
  scenariosApi: { list: vi.fn(), get: vi.fn(), complete: vi.fn() },
  chatApi:      { start: vi.fn(), sendMessage: vi.fn(), getHistory: vi.fn(), getConversation: vi.fn() },
  calmApi:      { saveSession: vi.fn(), getPhrase: vi.fn() },
  panelApi:     { listChildren: vi.fn(), getChild: vi.fn(), saveNote: vi.fn() },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, full_name: 'Dra. García', role: 'specialist' },
    loading: false,
  }),
}))

const mockDocs = [
  {
    id: 1,
    original_name: 'guia-autismo.pdf',
    file_size_bytes: 204800,
    status: 'ready',
    chunk_count: 12,
    created_at: '2026-06-17T10:00:00Z',
  },
]

function renderBiblioteca() {
  return render(<MemoryRouter><Biblioteca /></MemoryRouter>)
}

describe('Biblioteca', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    bibliotecaApi.list.mockResolvedValue({ data: mockDocs })
    bibliotecaApi.upload.mockResolvedValue({ data: mockDocs[0] })
    bibliotecaApi.delete.mockResolvedValue({})
  })

  it('muestra lista de documentos al cargar', async () => {
    renderBiblioteca()
    await waitFor(() => {
      expect(screen.getByText('guia-autismo.pdf')).toBeInTheDocument()
    })
  })

  it('muestra mensaje si no hay documentos', async () => {
    bibliotecaApi.list.mockResolvedValueOnce({ data: [] })
    renderBiblioteca()
    await waitFor(() => {
      expect(
        screen.getByText('Aún no hay documentos en la biblioteca.')
      ).toBeInTheDocument()
    })
  })

  it('subir archivo llama a bibliotecaApi.upload', async () => {
    renderBiblioteca()
    await waitFor(() => screen.getByText('guia-autismo.pdf'))

    const file = new File(['%PDF-content'], 'nuevo.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]')
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(bibliotecaApi.upload).toHaveBeenCalledTimes(1)
    })
  })

  it('eliminar documento llama a bibliotecaApi.delete con id correcto', async () => {
    renderBiblioteca()
    await waitFor(() => screen.getByText('guia-autismo.pdf'))

    await userEvent.click(screen.getByText('Eliminar'))
    await userEvent.click(screen.getByText('Sí, eliminar'))

    await waitFor(() => {
      expect(bibliotecaApi.delete).toHaveBeenCalledWith(1)
    })
  })

  it('error en upload muestra mensaje de error visible', async () => {
    bibliotecaApi.upload.mockRejectedValueOnce(new Error('Network'))
    renderBiblioteca()
    await waitFor(() => screen.getByText('guia-autismo.pdf'))

    const file = new File(['%PDF-content'], 'error.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]')
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(
        screen.getByText('No se pudo subir el documento. Intentá de nuevo.')
      ).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Ejecutar tests para verificar que fallan (sin implementación)**

```bash
cd frontend
npm test -- --run src/test/Biblioteca.test.jsx
```
Salida esperada: `FAIL` con `Cannot find module '../pages/Biblioteca'`.

- [ ] **Step 3: Agregar bibliotecaApi a api.js**

En `frontend/src/services/api.js`, agregar al final (después de `panelApi`):
```js
export const bibliotecaApi = {
  upload: (formData) =>
    api.post('/biblioteca/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  list:   ()      => api.get('/biblioteca/documents'),
  delete: (docId) => api.delete(`/biblioteca/documents/${docId}`),
}
```

- [ ] **Step 4: Crear Biblioteca.jsx**

Crear `frontend/src/pages/Biblioteca.jsx`:
```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { bibliotecaApi } from '../services/api'
import { PageWrapper } from '../components/layout/PageWrapper'

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

const STATUS_BADGE = {
  ready:      { label: 'Listo',        cls: 'bg-green-100 text-green-700' },
  processing: { label: 'Procesando...', cls: 'bg-yellow-100 text-yellow-700' },
  failed:     { label: 'Error',         cls: 'bg-red-100 text-red-700' },
}

export function Biblioteca() {
  const navigate = useNavigate()
  const [documents, setDocuments]   = useState([])
  const [uploading, setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [confirmId, setConfirmId]   = useState(null)

  async function loadDocs() {
    try {
      const res = await bibliotecaApi.list()
      setDocuments(res.data)
    } catch {
      // silent — lista vacía si falla
    }
  }

  useEffect(() => { loadDocs() }, [])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setUploadError('Solo se permiten archivos PDF.')
      e.target.value = ''
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('El archivo es demasiado grande (máximo 10 MB).')
      e.target.value = ''
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      await bibliotecaApi.upload(formData)
      e.target.value = ''
      await loadDocs()
    } catch {
      setUploadError('No se pudo subir el documento. Intentá de nuevo.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(docId) {
    try {
      await bibliotecaApi.delete(docId)
      setConfirmId(null)
      await loadDocs()
    } catch {
      // silent
    }
  }

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">

        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/inicio')}
            className="text-primary-600 text-base font-bold min-h-[44px] px-2"
            aria-label="Volver al inicio"
          >
            ← Volver
          </button>
          <h1 className="text-xl font-extrabold text-primary-700">Biblioteca educativa</h1>
        </div>

        {/* Formulario de subida */}
        <div className="bg-calm-surface border-2 border-calm-border rounded-3xl p-5 flex flex-col gap-3">
          <p className="text-base font-bold text-text-primary">Subir documento PDF</p>
          <input
            type="file"
            accept=".pdf"
            onChange={handleUpload}
            disabled={uploading}
            className="text-base text-text-primary"
          />
          {uploading && (
            <p className="text-base text-text-secondary">Subiendo...</p>
          )}
          {uploadError && (
            <p className="text-base text-red-600">{uploadError}</p>
          )}
        </div>

        {/* Lista de documentos */}
        {documents.length === 0 ? (
          <p className="text-base text-text-secondary text-center py-4">
            Aún no hay documentos en la biblioteca.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {documents.map((doc, i) => {
              const badge = STATUS_BADGE[doc.status] || STATUS_BADGE.failed
              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-calm-surface border-2 border-calm-border rounded-2xl p-4 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <p className="text-base font-bold text-text-primary truncate">
                        {doc.original_name}
                      </p>
                      <p className="text-base text-text-secondary">
                        {formatSize(doc.file_size_bytes)} · {doc.chunk_count} fragmentos
                      </p>
                      <p className="text-base text-text-secondary">
                        {new Date(doc.created_at).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                    <span className={`text-base px-3 py-1 rounded-full font-semibold shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>

                  {confirmId === doc.id ? (
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <p className="text-base text-text-secondary">¿Eliminar este documento?</p>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="text-base font-bold text-red-600 min-h-[44px] px-3"
                      >
                        Sí, eliminar
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="text-base text-text-secondary min-h-[44px] px-3"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(doc.id)}
                      className="text-base text-red-500 font-semibold min-h-[44px] text-left"
                    >
                      Eliminar
                    </button>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}

      </div>
    </PageWrapper>
  )
}
```

- [ ] **Step 5: Agregar la ruta /biblioteca en router/index.jsx**

En `frontend/src/router/index.jsx`, agregar la importación de `Biblioteca` y la ruta:

Importación (junto a las demás, línea ~13):
```jsx
import { Biblioteca }        from '../pages/Biblioteca'
```

Ruta nueva, agregar después de la ruta `/panel/ninos/:childId`:
```jsx
  {
    path: '/biblioteca',
    element: <SpecialistRoute><Biblioteca /></SpecialistRoute>,
  },
```

El array final de rutas queda:
```jsx
export const router = createBrowserRouter([
  { path: '/',         element: <Welcome /> },
  { path: '/login',    element: <Login /> },
  { path: '/registro', element: <Register /> },
  { path: '/inicio',   element: <ProtectedRoute><Dashboard /></ProtectedRoute> },
  { path: '/emociones', element: <ProtectedRoute><EmotionSelector /></ProtectedRoute> },
  { path: '/escenarios', element: <ProtectedRoute><ScenarioList /></ProtectedRoute> },
  { path: '/escenarios/:scenarioId', element: <ProtectedRoute><ScenarioFlow /></ProtectedRoute> },
  { path: '/chat',     element: <ProtectedRoute><ChatIA /></ProtectedRoute> },
  { path: '/calma',    element: <ProtectedRoute><ZonaCalma /></ProtectedRoute> },
  { path: '/panel',    element: <SpecialistRoute><PanelProfesional /></SpecialistRoute> },
  { path: '/panel/ninos/:childId', element: <SpecialistRoute><ChildDetail /></SpecialistRoute> },
  { path: '/biblioteca', element: <SpecialistRoute><Biblioteca /></SpecialistRoute> },
])
```

- [ ] **Step 6: Actualizar Dashboard.jsx con SPECIALIST_CARDS**

En `frontend/src/pages/Dashboard.jsx`, reemplazar la constante `SPECIALIST_CARD` (singular) por `SPECIALIST_CARDS` (array) y actualizar el `cards`:

Cambiar las líneas 46–61 (la constante y el cards):
```jsx
const SPECIALIST_CARDS = [
  {
    emoji: '📊',
    title: 'Panel Profesional',
    desc: 'Historial de los niños',
    available: true,
    path: '/panel',
  },
  {
    emoji: '📚',
    title: 'Biblioteca',
    desc: 'Documentos educativos para Lumi',
    available: true,
    path: '/biblioteca',
  },
]

export function Dashboard() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()
  const firstName        = user?.full_name?.split(' ')[0] || 'Bienvenido'

  const cards = user?.role === 'specialist'
    ? [...MODULE_CARDS, ...SPECIALIST_CARDS]
    : MODULE_CARDS
```

(El resto del componente Dashboard queda igual.)

- [ ] **Step 7: Ejecutar los tests de Biblioteca**

```bash
cd frontend
npm test -- --run src/test/Biblioteca.test.jsx
```
Salida esperada:
```
✓ Biblioteca > muestra lista de documentos al cargar
✓ Biblioteca > muestra mensaje si no hay documentos
✓ Biblioteca > subir archivo llama a bibliotecaApi.upload
✓ Biblioteca > eliminar documento llama a bibliotecaApi.delete con id correcto
✓ Biblioteca > error en upload muestra mensaje de error visible

Test Files  1 passed (1)
Tests       5 passed (5)
```

- [ ] **Step 8: Ejecutar suite frontend completa**

```bash
cd frontend
npm test -- --run
```
Salida esperada: todos los tests pasan sin regresiones.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/services/api.js \
        frontend/src/pages/Biblioteca.jsx \
        frontend/src/router/index.jsx \
        frontend/src/pages/Dashboard.jsx \
        frontend/src/test/Biblioteca.test.jsx
git commit -m "feat: Biblioteca.jsx — upload/lista/eliminar PDFs, ruta /biblioteca, SPECIALIST_CARDS"
```
