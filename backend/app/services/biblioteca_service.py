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


_STOP_WORDS = {
    "qué", "que", "es", "el", "la", "los", "las", "de", "del", "en", "y",
    "o", "a", "un", "una", "unos", "unas", "se", "su", "sus", "con", "por",
    "para", "como", "me", "te", "le", "nos", "les", "mi", "tu", "lo", "al",
    "hay", "más", "pero", "si", "no", "también", "esto", "esta", "este",
    "ese", "esa", "esos", "esas", "son", "ser", "fue", "era", "han", "has",
    "he", "del", "al", "sobre", "entre", "desde", "hasta", "hacia", "sin",
}


def _keyword_score(query: str, text: str) -> float:
    all_query_words = set(re.findall(r"\w+", query.lower()))
    query_words = all_query_words - _STOP_WORDS
    if not query_words:
        query_words = all_query_words  # fallback si todo son stop words
    text_word_set = set(re.findall(r"\w+", text.lower()))
    if not query_words or not text_word_set:
        return 0.0
    matches = sum(1 for w in query_words if w in text_word_set)
    return matches / len(query_words)


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
