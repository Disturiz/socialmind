# Biblioteca Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar endpoint `POST /api/v1/biblioteca/ask` y UI en Dashboard + PanelProfesional para que padres y especialistas consulten documentos de la biblioteca con respuesta de IA y voz.

**Architecture:** Un endpoint único detecta el rol del usuario desde JWT y adapta el system prompt de Claude (técnico para especialista, simple para padre). El frontend usa un componente reutilizable `BibliotecaChat` montado en dos rutas distintas. La voz usa Web Speech API del navegador, sin backend adicional.

**Tech Stack:** FastAPI, Pydantic v2, Anthropic SDK (`claude-haiku-4-5-20251001`), React, Web Speech API

## Global Constraints

- Modelo Claude: `claude-haiku-4-5-20251001`
- Máximo 3 fuentes por respuesta, fragmentos truncados a 150 caracteres
- Idioma de voz: `es-419`
- Sin tablas nuevas en la base de datos
- El endpoint `/ask` requiere cualquier usuario autenticado (`get_current_user`), no solo especialistas
- Pydantic `Field(min_length=1)` para validar pregunta no vacía → 422 automático

---

### Task 1: Schemas + refactor service + función `ask()`

**Files:**

- Modify: `backend/app/schemas/biblioteca.py`
- Modify: `backend/app/services/biblioteca_service.py`
- Modify: `backend/tests/test_biblioteca.py`

**Interfaces:**

- Produces:
  - `BibliotecaAskRequest(question: str)` — Pydantic model
  - `SourceFragment(doc_name: str, fragment: str)` — Pydantic model
  - `BibliotecaAskResponse(answer: str, sources: list[SourceFragment])` — Pydantic model
  - `biblioteca_service.ask(db: Session, question: str, role: str) -> dict`

- [ ] **Step 1: Agregar schemas**

Reemplaza el contenido de `backend/app/schemas/biblioteca.py`:

```python
from datetime import datetime
from pydantic import BaseModel, Field


class DocumentOut(BaseModel):
    id: int
    original_name: str
    file_size_bytes: int
    status: str
    chunk_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class BibliotecaAskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)


class SourceFragment(BaseModel):
    doc_name: str
    fragment: str


class BibliotecaAskResponse(BaseModel):
    answer: str
    sources: list[SourceFragment]
```

- [ ] **Step 2: Refactorizar `biblioteca_service.py` — agregar `_search_chunks` y `ask()`**

Reemplaza el contenido completo de `backend/app/services/biblioteca_service.py`:

```python
import os
import re
import uuid
from datetime import datetime, timezone

import anthropic
import pdfplumber
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models.document import Document
from app.models.document_chunk import DocumentChunk

DATA_DIR = os.environ.get("BIBLIOTECA_DATA_DIR", "/data/biblioteca")

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
CHUNK_MAX_WORDS = 400
CHUNK_OVERLAP_WORDS = 40

SYSTEM_SPECIALIST = (
    "Eres un asistente clínico especializado en trastornos del desarrollo. "
    "Responde con precisión técnica basándote en los fragmentos de documentos provistos. "
    "Usa terminología profesional. Sé conciso. "
    "Si los fragmentos no contienen la respuesta, indícalo claramente."
)

SYSTEM_PARENT = (
    "Eres un asistente amable que ayuda a padres de niños con autismo. "
    "Explica en lenguaje simple y cálido, sin términos médicos. "
    "Basa tu respuesta en los fragmentos provistos. Da consejos prácticos cuando sea posible. "
    "Si los fragmentos no contienen la respuesta, dilo con empatía."
)

anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)


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


def _keyword_score(query: str, text: str) -> float:
    query_words = set(re.findall(r"\w+", query.lower()))
    text_words = re.findall(r"\w+", text.lower())
    if not query_words or not text_words:
        return 0.0
    matches = sum(1 for w in text_words if w in query_words)
    return matches / len(text_words)


def _search_chunks(db: Session, query: str, top_k: int = 3) -> list[tuple[str, str]]:
    """Returns list of (content, original_name) tuples sorted by relevance."""
    rows = (
        db.query(DocumentChunk, Document.original_name)
        .join(Document, DocumentChunk.document_id == Document.id)
        .filter(Document.status == "ready")
        .all()
    )
    if not rows:
        return []
    scored = [
        (_keyword_score(query, chunk.content), chunk, original_name)
        for chunk, original_name in rows
    ]
    scored.sort(key=lambda x: x[0], reverse=True)
    return [(chunk.content, original_name) for _, chunk, original_name in scored[:top_k]]


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
            db.add(DocumentChunk(
                document_id=doc.id,
                chunk_index=i,
                content=chunk_content,
                embedding="[]",
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
        if os.path.exists(file_path):
            os.remove(file_path)
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
    chunks = _search_chunks(db, query, top_k)
    if not chunks:
        return ""
    parts = [
        f'[Fragmento {i} de "{name}"]:\n{content}'
        for i, (content, name) in enumerate(chunks, 1)
    ]
    return "\n\n".join(parts)


def ask(db: Session, question: str, role: str) -> dict:
    chunks = _search_chunks(db, question, top_k=3)

    if not chunks:
        return {
            "answer": "Aún no hay documentos en la biblioteca. Un especialista debe subir documentos primero.",
            "sources": [],
        }

    context = "\n\n".join(
        f'[Fragmento {i} de "{name}"]:\n{content}'
        for i, (content, name) in enumerate(chunks, 1)
    )
    system = SYSTEM_SPECIALIST if role == "specialist" else SYSTEM_PARENT

    try:
        response = anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=system,
            messages=[{
                "role": "user",
                "content": f"Fragmentos de documentos:\n\n{context}\n\nPregunta: {question}",
            }],
        )
        answer = response.content[0].text
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Servicio de IA no disponible. Intenta de nuevo.",
        )

    sources = [
        {"doc_name": name, "fragment": content[:150]}
        for content, name in chunks
    ]
    return {"answer": answer, "sources": sources}
```

- [ ] **Step 3: Escribir tests para `ask()`**

Agrega al final de `backend/tests/test_biblioteca.py`:

```python
def test_ask_no_documents_returns_default_message(client):
    token = _login(client, "parent_ask_empty@test.com", role="parent")
    response = client.post(
        "/api/v1/biblioteca/ask",
        json={"question": "¿Qué es el autismo?"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "especialista" in data["answer"].lower()
    assert data["sources"] == []


def test_ask_with_documents_calls_claude(client, db, tmp_path, monkeypatch):
    import app.services.biblioteca_service as bs
    monkeypatch.setattr(bs, "DATA_DIR", str(tmp_path))

    spec_token = _login(client, "spec_ask@test.com")
    parent_token = _login(client, "parent_ask@test.com", role="parent")
    spec_id = _me(client, spec_token)["id"]

    from datetime import datetime, timezone
    from app.models.document import Document
    from app.models.document_chunk import DocumentChunk

    doc = Document(
        specialist_id=spec_id,
        filename="test.pdf",
        original_name="guia_autismo.pdf",
        file_size_bytes=100,
        status="ready",
        chunk_count=1,
        created_at=datetime.now(timezone.utc),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    db.add(DocumentChunk(
        document_id=doc.id,
        chunk_index=0,
        content="Las rutinas predecibles son fundamentales para niños con autismo.",
        embedding="[]",
        created_at=datetime.now(timezone.utc),
    ))
    db.commit()

    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="Las rutinas ayudan a reducir la ansiedad.")]

    with patch("app.services.biblioteca_service.anthropic_client") as mock_claude:
        mock_claude.messages.create.return_value = mock_response
        response = client.post(
            "/api/v1/biblioteca/ask",
            json={"question": "rutinas autismo"},
            headers={"Authorization": f"Bearer {parent_token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "Las rutinas ayudan a reducir la ansiedad."
    assert len(data["sources"]) == 1
    assert data["sources"][0]["doc_name"] == "guia_autismo.pdf"
    assert len(data["sources"][0]["fragment"]) <= 150


def test_ask_empty_question_returns_422(client):
    token = _login(client, "parent_ask_empty2@test.com", role="parent")
    response = client.post(
        "/api/v1/biblioteca/ask",
        json={"question": ""},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def test_ask_unauthenticated_returns_401(client):
    response = client.post(
        "/api/v1/biblioteca/ask",
        json={"question": "¿Qué es el autismo?"},
    )
    assert response.status_code == 401
```

También corrige el test `test_upload_document_creates_record_and_chunks` que parchaba `openai_client` (que ya no existe). Reemplaza ese test:

```python
def test_upload_document_creates_record_and_chunks(client, db, tmp_path, monkeypatch):
    import app.services.biblioteca_service as bs
    monkeypatch.setattr(bs, "DATA_DIR", str(tmp_path))

    token = _login(client, "spec_upload@test.com")

    mock_page = MagicMock()
    mock_page.extract_text.return_value = "Texto sobre autismo y regulación emocional en niños. " * 20

    with patch("pdfplumber.open") as mock_pdfplumber:
        mock_pdfplumber.return_value.__enter__ = MagicMock(
            return_value=MagicMock(pages=[mock_page])
        )
        mock_pdfplumber.return_value.__exit__ = MagicMock(return_value=False)

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
```

- [ ] **Step 4: Correr tests**

```bash
cd backend && pytest tests/test_biblioteca.py -v
```

Resultado esperado: todos los tests pasan, incluyendo los 4 nuevos.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/biblioteca.py backend/app/services/biblioteca_service.py backend/tests/test_biblioteca.py
git commit -m "feat: schemas y servicio ask() para chat con documentos de biblioteca"
```

---

### Task 2: Endpoint `POST /api/v1/biblioteca/ask`

**Files:**

- Modify: `backend/app/routers/biblioteca.py`

**Interfaces:**

- Consumes: `BibliotecaAskRequest`, `BibliotecaAskResponse`, `SourceFragment` (de Task 1); `biblioteca_service.ask(db, question, role)` (de Task 1)
- Produces: `POST /api/v1/biblioteca/ask` → `BibliotecaAskResponse`

- [ ] **Step 1: Agregar endpoint al router**

Reemplaza el contenido de `backend/app/routers/biblioteca.py`:

```python
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_specialist
from app.database import get_db
from app.models.user import User
from app.schemas.biblioteca import (
    BibliotecaAskRequest,
    BibliotecaAskResponse,
    DocumentOut,
    SourceFragment,
)
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
    if not file_bytes.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El archivo no es un PDF válido.",
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


@router.post("/ask", response_model=BibliotecaAskResponse)
def ask_biblioteca(
    data: BibliotecaAskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = biblioteca_service.ask(db, data.question, current_user.role.value)
    return BibliotecaAskResponse(
        answer=result["answer"],
        sources=[SourceFragment(**s) for s in result["sources"]],
    )
```

- [ ] **Step 2: Correr tests**

```bash
cd backend && pytest tests/test_biblioteca.py -v
```

Resultado esperado: todos los tests pasan.

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/biblioteca.py
git commit -m "feat: endpoint POST /api/v1/biblioteca/ask"
```

---

### Task 3: Frontend — API client + componente `BibliotecaChat`

**Files:**

- Modify: `frontend/src/services/api.js`
- Create: `frontend/src/components/BibliotecaChat.jsx`

**Interfaces:**

- Produces:
  - `bibliotecaApi.ask(question: string)` → Promise con `{ answer, sources }`
  - `<BibliotecaChat />` — componente sin props (lee `user.role` del contexto)

- [ ] **Step 1: Agregar método `ask` a `bibliotecaApi`**

En `frontend/src/services/api.js`, reemplaza el bloque `bibliotecaApi`:

```js
export const bibliotecaApi = {
  upload: (formData) =>
    api.post("/biblioteca/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  list: () => api.get("/biblioteca/documents"),
  delete: (docId) => api.delete(`/biblioteca/documents/${docId}`),
  ask: (question) => api.post("/biblioteca/ask", { question }),
};
```

- [ ] **Step 2: Crear componente `BibliotecaChat.jsx`**

Crea `frontend/src/components/BibliotecaChat.jsx`:

```jsx
import { useState, useRef } from "react";
import { bibliotecaApi } from "../services/api";
import { useAuth } from "../context/AuthContext";

export function BibliotecaChat() {
  const { user } = useAuth();
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef(null);

  const isSpecialist = user?.role === "specialist";
  const placeholder = isSpecialist
    ? "Escribe tu consulta clínica..."
    : "¿Tienes alguna pregunta sobre el autismo?";

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await bibliotecaApi.ask(question);
      setResult(res.data);
    } catch {
      setError("Ocurrió un error al consultar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const handleSpeak = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(result.answer);
    utterance.lang = "es-419";
    utterance.onend = () => setSpeaking(false);
    utteranceRef.current = utterance;
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={3}
        className="
          w-full rounded-2xl border-2 border-calm-border p-4
          text-base text-text-primary bg-calm-surface
          resize-none focus:outline-none focus:border-primary-500
        "
      />
      <button
        onClick={handleAsk}
        disabled={loading || !question.trim()}
        className="
          self-start px-6 py-3 rounded-2xl bg-primary-600 text-white
          font-bold text-base hover:bg-primary-700 disabled:opacity-50
          transition-colors
        "
      >
        {loading ? "Consultando..." : "Consultar"}
      </button>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {result && (
        <div className="flex flex-col gap-3 p-5 rounded-3xl bg-calm-surface border-2 border-calm-border">
          <p className="text-base text-text-primary whitespace-pre-wrap leading-relaxed">
            {result.answer}
          </p>

          <button
            onClick={handleSpeak}
            className="
              self-start flex items-center gap-2 px-4 py-2 rounded-xl
              bg-primary-50 border border-primary-200 text-primary-700
              text-sm font-medium hover:bg-primary-100 transition-colors
            "
          >
            {speaking ? "⏹ Detener" : "🔊 Escuchar respuesta"}
          </button>

          {result.sources.length > 0 && (
            <details className="mt-1">
              <summary className="text-sm font-semibold text-text-secondary cursor-pointer select-none">
                Fuentes ({result.sources.length})
              </summary>
              <div className="flex flex-col gap-2 mt-3">
                {result.sources.map((s, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-surface border border-calm-border"
                  >
                    <p className="text-xs font-bold text-text-secondary mb-1">
                      {s.doc_name}
                    </p>
                    <p className="text-sm text-text-primary">{s.fragment}…</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/api.js frontend/src/components/BibliotecaChat.jsx
git commit -m "feat: componente BibliotecaChat y método ask en bibliotecaApi"
```

---

### Task 4: Frontend — página, rutas y puntos de entrada en Dashboard y Panel

**Files:**

- Create: `frontend/src/pages/BibliotecaChatPage.jsx`
- Modify: `frontend/src/router/index.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`
- Modify: `frontend/src/pages/PanelProfesional.jsx`

**Interfaces:**

- Consumes: `<BibliotecaChat />` (de Task 3)
- Produces: ruta `/biblioteca/consultar` accesible para cualquier usuario autenticado

- [ ] **Step 1: Crear `BibliotecaChatPage.jsx`**

Crea `frontend/src/pages/BibliotecaChatPage.jsx`:

```jsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageWrapper } from "../components/layout/PageWrapper";
import { BibliotecaChat } from "../components/BibliotecaChat";

export function BibliotecaChatPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSpecialist = user?.role === "specialist";
  const backPath = isSpecialist ? "/panel" : "/inicio";

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(backPath)}
            className="text-primary-600 text-base font-bold min-h-[44px] px-2"
            aria-label="Volver"
          >
            ← Volver
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-primary-700">
              Consultar Biblioteca
            </h1>
            <p className="text-sm text-text-secondary">
              {isSpecialist
                ? "Consulta los documentos clínicos subidos a la biblioteca"
                : "Encuentra información sobre el autismo en los documentos educativos"}
            </p>
          </div>
        </div>

        <BibliotecaChat />
      </div>
    </PageWrapper>
  );
}
```

- [ ] **Step 2: Agregar ruta en `router/index.jsx`**

En `frontend/src/router/index.jsx`, agrega el import:

```js
import { BibliotecaChatPage } from "../pages/BibliotecaChatPage";
```

Y agrega la ruta antes del cierre del array `createBrowserRouter([...])`:

```js
  {
    path: '/biblioteca/consultar',
    element: <ProtectedRoute><BibliotecaChatPage /></ProtectedRoute>,
  },
```

- [ ] **Step 3: Agregar tarjeta en `Dashboard.jsx` para padres**

En `frontend/src/pages/Dashboard.jsx`, en el array `MODULE_CARDS`, agrega al final:

```js
  {
    emoji: '📖',
    title: 'Consultar Biblioteca',
    desc: 'Pregunta sobre el autismo a la IA',
    available: true,
    path: '/biblioteca/consultar',
  },
```

Y en el array `SPECIALIST_CARDS`, agrega al final:

```js
  {
    emoji: '📖',
    title: 'Consultar Biblioteca',
    desc: 'Consulta los documentos educativos',
    available: true,
    path: '/biblioteca/consultar',
  },
```

- [ ] **Step 4: Agregar tarjeta en `PanelProfesional.jsx`**

En `frontend/src/pages/PanelProfesional.jsx`, agrega el import de `useNavigate` si no está (ya está en el archivo). Luego, después del botón "← Volver" y el título, agrega un botón de acceso rápido a la biblioteca. Localiza el bloque del header y agrégalo así:

Busca el bloque:

```jsx
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/inicio')}
```

Y después del cierre del `</div>` de ese bloque, agrega:

```jsx
<button
  onClick={() => navigate("/biblioteca/consultar")}
  className="
            w-full flex items-center gap-4 p-5 rounded-3xl text-left
            bg-calm-surface border-2 border-calm-border
            hover:border-primary-500 hover:bg-primary-50
            transition-all font-semibold text-base text-text-primary
          "
>
  <span className="text-3xl">📖</span>
  <div>
    <div className="font-bold text-text-primary">Consultar Biblioteca</div>
    <div className="text-sm text-text-secondary">
      Consulta los documentos clínicos con IA
    </div>
  </div>
</button>
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/BibliotecaChatPage.jsx frontend/src/router/index.jsx frontend/src/pages/Dashboard.jsx frontend/src/pages/PanelProfesional.jsx
git commit -m "feat: página y rutas para consultar biblioteca — padres y especialistas"
```

---

### Task 5: Deploy en VPS

- [ ] **Step 1: Push a GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Pull y rebuild en el VPS**

```bash
cd /root/socialmind && git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

- [ ] **Step 3: Verificar que el endpoint responde**

```bash
curl -s http://localhost:8080/api/v1/biblioteca/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "test"}' | head -c 100
```

Resultado esperado: respuesta JSON con `answer` y `sources` (o error 401 si no hay token — ambos confirman que el endpoint existe).

- [ ] **Step 4: Probar en el navegador**

1. Ir a https://socialmind.it.com, iniciar sesión como padre (`padre@prueba.com` / `Prueba123!`)
2. En el Dashboard, verificar que aparece la tarjeta "📖 Consultar Biblioteca"
3. Hacer clic → escribir "¿Cómo ayudo a mi hijo con las rutinas?" → Consultar
4. Verificar respuesta de IA + botón de voz funciona
5. Iniciar sesión como especialista (`esp@prueba.com` / `Prueba123!`)
6. En el Panel Profesional, verificar el botón "📖 Consultar Biblioteca"
7. Verificar que la respuesta es más técnica que la del padre
