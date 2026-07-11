from datetime import datetime, timezone
from sqlalchemy import String, Integer, ForeignKey, DateTime, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class AdultMessage(Base):
    __tablename__ = "adult_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    conversation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("adult_conversations.id"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)   # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    conversation: Mapped["AdultConversation"] = relationship(
        "AdultConversation", back_populates="messages"
    )

    __table_args__ = (
        Index("ix_adult_messages_conv_created", "conversation_id", "created_at"),
    )
