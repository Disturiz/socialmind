from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_specialist
from app.database import get_db
from app.models.user import User
from app.schemas.biblioteca import BibliotecaAskRequest, BibliotecaAskResponse, DocumentOut
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
def ask_document(
    body: BibliotecaAskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = biblioteca_service.ask(db, body.question, current_user.role)
    return result
