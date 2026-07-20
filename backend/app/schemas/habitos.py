from datetime import datetime
from pydantic import BaseModel


class HabitInfographicOut(BaseModel):
    id: int
    title: str
    description: str | None
    category: str
    file_type: str
    original_name: str
    file_size_bytes: int
    created_at: datetime

    model_config = {"from_attributes": True}
