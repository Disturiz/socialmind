import anthropic
from sqlalchemy.orm import Session
from app.config import settings
from app.models.calm_session import CalmSession

anthropic_calm_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

PHRASE_SYSTEM = (
    "Eres Lumi, un búho amigable y calmado. "
    "Genera UNA sola frase corta y calmante (máximo 15 palabras) "
    "para un niño de 8-17 años. "
    "Solo la frase, sin comillas, sin saludo, en español latinoamericano."
)

FALLBACK_PHRASE = "Estás bien. Respira. Todo va a estar bien."


def save_session(
    db: Session,
    user_id: int,
    activity_type: str,
    duration_seconds: int,
    emotion_key: str,
) -> CalmSession:
    session = CalmSession(
        user_id=user_id,
        activity_type=activity_type,
        duration_seconds=duration_seconds,
        emotion_key=emotion_key,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def generate_phrase(emotion_key: str) -> str:
    try:
        response = anthropic_calm_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=60,
            system=PHRASE_SYSTEM,
            messages=[{"role": "user", "content": f"Me siento {emotion_key}."}],
        )
        if response.content:
            return response.content[0].text.strip()
        return FALLBACK_PHRASE
    except Exception:
        return FALLBACK_PHRASE
