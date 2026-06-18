import anthropic
from datetime import datetime, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.config import settings
from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage
from app.services import biblioteca_service

MAX_MESSAGES = 30

RESPOND_TOOL = {
    "name": "respond_to_child",
    "description": "Responde al niño con un mensaje y opciones de respuesta.",
    "input_schema": {
        "type": "object",
        "properties": {
            "message": {
                "type": "string",
                "description": "Mensaje de Lumi (máx. 3 oraciones cortas)",
            },
            "options": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 3,
                "maxItems": 4,
                "description": "Opciones de respuesta. La última siempre es 'Terminar'.",
            },
            "lumi_state": {
                "type": "string",
                "enum": ["happy", "thinking", "encouraging", "idle"],
            },
        },
        "required": ["message", "options", "lumi_state"],
    },
}

SEARCH_TOOL = {
    "name": "search_library",
    "description": (
        "Busca en la biblioteca educativa cuando el niño menciona algo "
        "sobre lo que querés agregar contexto de los documentos subidos "
        "por especialistas. Solo úsala cuando sea relevante para la conversación."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Texto de búsqueda semántica en la biblioteca",
            }
        },
        "required": ["query"],
    },
}

SYSTEM_PROMPT_TEMPLATE = (
    "Eres Lumi, un búho amigable y paciente que acompaña a niños y adolescentes "
    "(8-17 años) en su aprendizaje social y emocional.\n\n"
    "PERSONALIDAD: cálida, calmada, alentadora. Nunca sarcástica, nunca clínica.\n\n"
    "REGLAS:\n"
    "- Responde siempre en español latinoamericano\n"
    "- Frases cortas y simples (máximo 3 oraciones por mensaje)\n"
    "- Jamás uses términos médicos, diagnósticos ni clínicos\n"
    "- Mantén el tema relacionado a la emoción inicial o lo que el niño elija\n"
    "- Si el niño expresa angustia severa o peligro, responde: "
    "'Eso suena muy importante. ¿Podés contarle a un adulto de confianza cómo te sentís?'\n"
    "- La última opción de respuesta SIEMPRE es 'Terminar'\n"
    "- Usa respond_to_child para cada respuesta. Usa search_library solo si el "
    "contexto de la biblioteca educativa sería útil para el niño.\n\n"
    "CONTEXTO DE HOY: El niño se siente {emotion_key}."
)

FALLBACK_RESPONSE = {
    "message": "Lo siento, hubo un problema técnico. ¿Podés intentarlo de nuevo?",
    "options": ["Reintentar", "Terminar"],
    "lumi_state": "idle",
}

# Singleton — se parchea en tests con unittest.mock.patch
anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)


def _build_messages(emotion_key: str, db_messages: list[ChatMessage]) -> list[dict]:
    msgs: list[dict] = [
        {"role": "user", "content": f"Hola Lumi, hoy me siento {emotion_key}."}
    ]
    for m in db_messages:
        msgs.append({"role": m.role, "content": m.content})
    return msgs


def _call_anthropic(
    emotion_key: str, db_messages: list[ChatMessage], db: Session
) -> dict:
    system = SYSTEM_PROMPT_TEMPLATE.format(emotion_key=emotion_key)
    messages = _build_messages(emotion_key, db_messages)
    max_iterations = 3

    for _ in range(max_iterations):
        response = anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=system,
            tools=[RESPOND_TOOL, SEARCH_TOOL],
            tool_choice={"type": "auto"},
            messages=messages,
        )

        search_use = next(
            (b for b in response.content
             if b.type == "tool_use" and b.name == "search_library"),
            None,
        )
        respond_use = next(
            (b for b in response.content
             if b.type == "tool_use" and b.name == "respond_to_child"),
            None,
        )

        if respond_use:
            return respond_use.input

        if search_use:
            results = biblioteca_service.search(db, search_use.input["query"], top_k=3)
            messages.append({"role": "assistant", "content": response.content})
            messages.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": search_use.id,
                    "content": results,
                }],
            })
        else:
            break

    return FALLBACK_RESPONSE


def start_conversation(db: Session, user_id: int, emotion_key: str) -> dict:
    conv = ChatConversation(user_id=user_id, emotion_key=emotion_key)
    db.add(conv)
    db.flush()

    lumi_resp = _call_anthropic(emotion_key, [], db)

    db.add(ChatMessage(
        conversation_id=conv.id,
        role="assistant",
        content=lumi_resp["message"],
    ))
    db.commit()
    db.refresh(conv)

    return {
        "conversation_id": conv.id,
        "message": lumi_resp["message"],
        "options": lumi_resp["options"],
        "lumi_state": lumi_resp["lumi_state"],
    }


def send_message(db: Session, user_id: int, conversation_id: int, content: str) -> dict:
    conv = (
        db.query(ChatConversation)
        .filter(ChatConversation.id == conversation_id, ChatConversation.user_id == user_id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversación no encontrada.")
    if conv.ended_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La conversación ya terminó.")

    db.add(ChatMessage(conversation_id=conv.id, role="user", content=content))
    db.flush()

    ended = content.strip().lower() == "terminar"

    if ended:
        conv.ended_at = datetime.now(timezone.utc)
        lumi_resp = {
            "message": "¡Fue un gusto conversar con vos! Espero que te haya ayudado. ¡Hasta la próxima!",
            "options": ["Terminar"],
            "lumi_state": "happy",
        }
    else:
        msg_count = (
            db.query(ChatMessage)
            .filter(ChatMessage.conversation_id == conv.id)
            .count()
        )
        if msg_count >= MAX_MESSAGES:
            conv.ended_at = datetime.now(timezone.utc)
            ended = True
            lumi_resp = {
                "message": "Hemos tenido una charla muy buena. ¡Fue genial hablar con vos hoy!",
                "options": ["Terminar"],
                "lumi_state": "happy",
            }
        else:
            history = (
                db.query(ChatMessage)
                .filter(ChatMessage.conversation_id == conv.id)
                .order_by(ChatMessage.created_at)
                .all()
            )
            lumi_resp = _call_anthropic(conv.emotion_key, history, db)

    db.add(ChatMessage(
        conversation_id=conv.id,
        role="assistant",
        content=lumi_resp["message"],
    ))
    db.commit()

    return {
        "message": lumi_resp["message"],
        "options": lumi_resp["options"],
        "lumi_state": lumi_resp["lumi_state"],
        "ended": ended,
    }


def get_history(db: Session, user_id: int) -> list[dict]:
    msg_counts = (
        db.query(
            ChatMessage.conversation_id,
            func.count(ChatMessage.id).label("count"),
        )
        .group_by(ChatMessage.conversation_id)
        .subquery()
    )
    rows = (
        db.query(ChatConversation, msg_counts.c.count)
        .outerjoin(msg_counts, ChatConversation.id == msg_counts.c.conversation_id)
        .filter(ChatConversation.user_id == user_id)
        .order_by(ChatConversation.started_at.desc())
        .limit(10)
        .all()
    )
    return [
        {
            "conversation_id": conv.id,
            "emotion_key": conv.emotion_key,
            "started_at": conv.started_at,
            "ended_at": conv.ended_at,
            "message_count": count or 0,
        }
        for conv, count in rows
    ]


def get_conversation(db: Session, user_id: int, conversation_id: int) -> dict:
    conv = (
        db.query(ChatConversation)
        .filter(ChatConversation.id == conversation_id, ChatConversation.user_id == user_id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversación no encontrada.")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conv.id)
        .order_by(ChatMessage.created_at)
        .all()
    )
    return {
        "conversation_id": conv.id,
        "emotion_key": conv.emotion_key,
        "messages": [
            {"role": m.role, "content": m.content, "created_at": m.created_at}
            for m in messages
        ],
    }
