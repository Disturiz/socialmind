import anthropic
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models.adult_conversation import AdultConversation
from app.models.adult_message import AdultMessage
from app.services import biblioteca_service

SYSTEM_SPECIALIST = (
    "Eres Lumi, un asistente clínico especializado en autismo y desarrollo infantil. "
    "Conversas con especialistas ofreciendo orientación basada en evidencia. "
    "Cuando dispongas de fragmentos de documentos relevantes, úsalos para fundamentar tus respuestas. "
    "Si no hay fragmentos aplicables, responde desde tu conocimiento general del espectro autista. "
    "Usa terminología profesional. Sé preciso y conciso."
)

SYSTEM_PARENT = (
    "Eres Lumi, un búho amigable y comprensivo que acompaña a padres de niños con autismo. "
    "Ofreces orientación cálida, práctica y sin tecnicismos. "
    "Cuando dispongas de fragmentos de documentos relevantes, úsalos para fundamentar tus respuestas. "
    "Si no hay fragmentos aplicables, responde desde tu conocimiento general del espectro autista. "
    "Habla siempre con empatía y esperanza."
)

anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)


def create_conversation(db: Session, user_id: int) -> AdultConversation:
    conv = AdultConversation(
        user_id=user_id,
        started_at=datetime.now(timezone.utc),
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def get_conversation(db: Session, conv_id: int, user_id: int) -> AdultConversation:
    conv = db.query(AdultConversation).filter(
        AdultConversation.id == conv_id,
        AdultConversation.user_id == user_id,
    ).first()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversación no encontrada.",
        )
    return conv


def send_message(
    db: Session, conv_id: int, user_id: int, content: str, role: str
) -> AdultMessage:
    get_conversation(db, conv_id, user_id)   # 404 if not owned

    user_msg = AdultMessage(
        conversation_id=conv_id,
        role="user",
        content=content,
        created_at=datetime.now(timezone.utc),
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    history = (
        db.query(AdultMessage)
        .filter(AdultMessage.conversation_id == conv_id)
        .order_by(AdultMessage.created_at)
        .all()
    )
    messages = [{"role": m.role, "content": m.content} for m in history]

    context = biblioteca_service.search(db, content, top_k=3)
    system = SYSTEM_SPECIALIST if role == "specialist" else SYSTEM_PARENT
    if context:
        system += f"\n\nFragmentos de documentos relevantes:\n\n{context}"

    try:
        response = anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=system,
            messages=messages,
        )
        answer = response.content[0].text
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Servicio de IA no disponible. Intenta de nuevo.",
        )

    assistant_msg = AdultMessage(
        conversation_id=conv_id,
        role="assistant",
        content=answer,
        created_at=datetime.now(timezone.utc),
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)
    return assistant_msg
