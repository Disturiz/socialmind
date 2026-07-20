import os
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.habit_infographic import HabitInfographic

DATA_DIR = os.environ.get("HABITOS_DATA_DIR", "/data/habitos")


def detect_file_type(content_type: str, file_bytes: bytes) -> tuple[str, str] | None:
    """Valida que el tipo MIME declarado y la firma de bytes coincidan.
    Retorna (file_type, extension) o None si no es un formato soportado."""
    if content_type == "application/pdf":
        return ("pdf", "pdf") if file_bytes.startswith(b"%PDF-") else None
    if content_type == "image/png":
        return ("image", "png") if file_bytes.startswith(b"\x89PNG\r\n\x1a\n") else None
    if content_type == "image/jpeg":
        return ("image", "jpg") if file_bytes.startswith(b"\xff\xd8\xff") else None
    if content_type == "image/webp":
        is_webp = file_bytes[:4] == b"RIFF" and file_bytes[8:12] == b"WEBP"
        return ("image", "webp") if is_webp else None
    return None


def save_infographic(
    db: Session,
    uploaded_by: int,
    file_bytes: bytes,
    file_type: str,
    ext: str,
    mime_type: str,
    title: str,
    category: str,
    description: str | None,
    original_name: str,
) -> HabitInfographic:
    os.makedirs(DATA_DIR, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(DATA_DIR, filename)
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    infographic = HabitInfographic(
        uploaded_by=uploaded_by,
        title=title,
        description=description,
        category=category,
        file_type=file_type,
        filename=filename,
        original_name=original_name,
        mime_type=mime_type,
        file_size_bytes=len(file_bytes),
        created_at=datetime.now(timezone.utc),
    )
    db.add(infographic)
    db.commit()
    db.refresh(infographic)
    return infographic


def list_infographics(db: Session, category: str | None = None) -> list[HabitInfographic]:
    query = db.query(HabitInfographic)
    if category:
        query = query.filter(HabitInfographic.category == category)
    return query.order_by(HabitInfographic.created_at.desc()).all()


def list_categorias(db: Session) -> list[str]:
    rows = (
        db.query(HabitInfographic.category)
        .distinct()
        .order_by(HabitInfographic.category)
        .all()
    )
    return [row[0] for row in rows]


def get_infographic(db: Session, infographic_id: int) -> HabitInfographic:
    infographic = db.query(HabitInfographic).filter(HabitInfographic.id == infographic_id).first()
    if not infographic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Infografía no encontrada.",
        )
    return infographic


def delete_infographic(
    db: Session,
    current_user_id: int,
    is_admin: bool,
    infographic_id: int,
) -> None:
    infographic = db.query(HabitInfographic).filter(HabitInfographic.id == infographic_id).first()
    if not infographic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Infografía no encontrada.",
        )
    if infographic.uploaded_by != current_user_id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Infografía no encontrada.",
        )

    file_path = os.path.join(DATA_DIR, infographic.filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    db.delete(infographic)
    db.commit()
