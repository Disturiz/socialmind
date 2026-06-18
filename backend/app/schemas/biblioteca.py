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
