from datetime import datetime
from pydantic import BaseModel


class SpecialistOut(BaseModel):
    id: int
    full_name: str
    email: str

    model_config = {"from_attributes": True}


class ParentOut(BaseModel):
    id: int
    full_name: str
    email: str

    model_config = {"from_attributes": True}


class AssignmentOut(BaseModel):
    id: int
    specialist_id: int
    child_profile_id: int
    assigned_at: datetime

    model_config = {"from_attributes": True}
