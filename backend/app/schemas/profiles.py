from datetime import datetime
from pydantic import BaseModel, field_validator

ALLOWED_AVATARS = ['🦊', '🐧', '🐸', '🦁', '🌟', '🐳', '🦋', '🐼']


class ChildProfileCreate(BaseModel):
    name: str
    age: int
    avatar_emoji: str

    @field_validator('name')
    @classmethod
    def name_valid(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 100:
            raise ValueError('El nombre debe tener entre 1 y 100 caracteres.')
        return v

    @field_validator('age')
    @classmethod
    def age_valid(cls, v: int) -> int:
        if v < 1 or v > 17:
            raise ValueError('La edad debe estar entre 1 y 17 años.')
        return v

    @field_validator('avatar_emoji')
    @classmethod
    def avatar_valid(cls, v: str) -> str:
        if v not in ALLOWED_AVATARS:
            raise ValueError('Avatar no permitido.')
        return v


class ChildProfileOut(BaseModel):
    id: int
    name: str
    age: int
    avatar_emoji: str
    created_at: datetime
    model_config = {"from_attributes": True}


class ParentProfileOut(BaseModel):
    child: ChildProfileOut | None
    model_config = {"from_attributes": True}
