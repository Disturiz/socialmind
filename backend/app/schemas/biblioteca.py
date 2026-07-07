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
