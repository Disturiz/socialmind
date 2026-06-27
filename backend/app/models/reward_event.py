from datetime import datetime, timezone
from sqlalchemy import String, Integer, ForeignKey, DateTime, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class RewardEvent(Base):
    __tablename__ = "reward_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    stars_earned: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    extra_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        Index("ix_reward_events_user_created", "user_id", "created_at"),
    )
