from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_specialist_or_admin
from app.database import get_db
from app.models.user import User
from app.schemas.habitos import HabitInfographicOut
from app.services import habitos_service

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

router = APIRouter()


@router.post("/upload", response_model=HabitInfographicOut, status_code=201)
def upload_infographic(
    file: UploadFile = File(...),
    title: str = Form(..., min_length=1, max_length=120),
    category: str = Form(..., min_length=1, max_length=60),
    description: str | None = Form(None, max_length=500),
    current_user: User = Depends(require_specialist_or_admin),
    db: Session = Depends(get_db),
):
    file_bytes = file.file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="El archivo excede el tamaño máximo de 10 MB.",
        )
    detected = habitos_service.detect_file_type(file.content_type, file_bytes)
    if detected is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El archivo debe ser una imagen (PNG, JPG, WebP) o un PDF válido.",
        )
    file_type, ext = detected
    return habitos_service.save_infographic(
        db=db,
        uploaded_by=current_user.id,
        file_bytes=file_bytes,
        file_type=file_type,
        ext=ext,
        mime_type=file.content_type,
        title=title,
        category=category,
        description=description,
        original_name=file.filename,
    )


@router.get("", response_model=list[HabitInfographicOut])
def list_infographics(
    category: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return habitos_service.list_infographics(db, category=category)


@router.get("/categorias", response_model=list[str])
def list_categorias(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return habitos_service.list_categorias(db)
