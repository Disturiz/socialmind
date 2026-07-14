from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, model_validator
from app.models.user import UserRole


class AdminUserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminUserUpdate(BaseModel):
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

    @model_validator(mode='after')
    def at_least_one_field(self) -> 'AdminUserUpdate':
        if self.role is None and self.is_active is None:
            raise ValueError('Debe proporcionar al menos un campo para actualizar.')
        return self
