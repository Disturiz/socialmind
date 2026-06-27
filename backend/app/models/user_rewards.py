from datetime import datetime, date, timezone
from sqlalchemy import String, Integer, ForeignKey, DateTime, JSON, Date, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class UserRewards(Base):
    __tablename__ = "user_rewards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    total_stars: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    current_level_key: Mapped[str] = mapped_column(String(30), nullable=False, default="explorador")
    current_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_activity_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    badges: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (UniqueConstraint("user_id"),)
