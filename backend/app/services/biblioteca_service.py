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
    rows = (
        db.query(DocumentChunk, Document.original_name)
        .join(Document, DocumentChunk.document_id == Document.id)
        .filter(Document.status == "ready")
        .all()
    )
    if not rows:
        return ""

    query_resp = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=query,
    )
    query_emb = query_resp.data[0].embedding

    scored = []
    for chunk, original_name in rows:
        chunk_emb = json.loads(chunk.embedding)
        sim = _cosine_similarity(query_emb, chunk_emb)
        scored.append((sim, chunk, original_name))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:top_k]

    parts = []
    for i, (_, chunk, original_name) in enumerate(top, 1):
        parts.append(f'[Fragmento {i} de "{original_name}"]:\n{chunk.content}')

    return "\n\n".join(parts)
