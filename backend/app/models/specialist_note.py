from datetime import datetime
from sqlalchemy import Integer, ForeignKey, DateTime, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class SpecialistNote(Base):
    __tablename__ = "specialist_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    specialist_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    child_profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("child_profiles.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    __table_args__ = (
        UniqueConstraint("specialist_id", "child_profile_id", name="uq_note_specialist_child"),
    )
