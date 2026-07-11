import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from app.models.user import User, UserRole
from app.models.adult_conversation import AdultConversation
from app.models.adult_message import AdultMessage
from app.core.security import hash_password
from app.services import lumi_chat_service


def _make_user(db, email="u@test.com", role=UserRole.parent):
    user = User(
        email=email,
        hashed_password=hash_password("pass"),
        full_name="Test User",
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_mock_claude(text="Respuesta de Lumi."):
    block = MagicMock()
    block.text = text
    resp = MagicMock()
    resp.content = [block]
    client = MagicMock()
    client.messages.create.return_value = resp
    return client


def test_create_conversation_returns_adult_conversation(db):
    user = _make_user(db)
    conv = lumi_chat_service.create_conversation(db, user.id)
    assert isinstance(conv, AdultConversation)
    assert conv.id is not None
    assert conv.user_id == user.id
    assert conv.started_at is not None


def test_get_conversation_returns_correct_conversation(db):
    user = _make_user(db, "gc1@test.com")
    conv = lumi_chat_service.create_conversation(db, user.id)
    found = lumi_chat_service.get_conversation(db, conv.id, user.id)
    assert found.id == conv.id


def test_get_conversation_wrong_user_raises_404(db):
    user1 = _make_user(db, "wu1@test.com")
    user2 = _make_user(db, "wu2@test.com")
    conv = lumi_chat_service.create_conversation(db, user1.id)
    with pytest.raises(HTTPException) as exc:
        lumi_chat_service.get_conversation(db, conv.id, user2.id)
    assert exc.value.status_code == 404


def test_get_nonexistent_conversation_raises_404(db):
    user = _make_user(db, "ne1@test.com")
    with pytest.raises(HTTPException) as exc:
        lumi_chat_service.get_conversation(db, 99999, user.id)
    assert exc.value.status_code == 404


def test_send_message_saves_user_and_assistant_messages(db):
    user = _make_user(db, "sm1@test.com")
    conv = lumi_chat_service.create_conversation(db, user.id)
    mock_client = _make_mock_claude("Claro, puedo ayudarte.")

    with patch("app.services.lumi_chat_service.anthropic_client", mock_client):
        reply = lumi_chat_service.send_message(db, conv.id, user.id, "Hola Lumi", "parent")

    assert isinstance(reply, AdultMessage)
    assert reply.role == "assistant"
    assert reply.content == "Claro, puedo ayudarte."

    msgs = db.query(AdultMessage).filter(
        AdultMessage.conversation_id == conv.id
    ).order_by(AdultMessage.created_at).all()
    assert len(msgs) == 2
    assert msgs[0].role == "user"
    assert msgs[0].content == "Hola Lumi"
    assert msgs[1].role == "assistant"


def test_send_message_uses_specialist_system_prompt(db):
    user = _make_user(db, "sp1@test.com", role=UserRole.specialist)
    conv = lumi_chat_service.create_conversation(db, user.id)
    mock_client = _make_mock_claude()

    with patch("app.services.lumi_chat_service.anthropic_client", mock_client):
        lumi_chat_service.send_message(db, conv.id, user.id, "¿Qué es el TEA?", "specialist")

    call_kwargs = mock_client.messages.create.call_args.kwargs
    assert "terminología profesional" in call_kwargs["system"].lower() or \
           "clínico" in call_kwargs["system"].lower()


def test_send_message_passes_history_to_claude(db):
    user = _make_user(db, "hist1@test.com")
    conv = lumi_chat_service.create_conversation(db, user.id)
    mock_client = _make_mock_claude("Primera respuesta.")

    with patch("app.services.lumi_chat_service.anthropic_client", mock_client):
        lumi_chat_service.send_message(db, conv.id, user.id, "Primera pregunta", "parent")

    mock_client2 = _make_mock_claude("Segunda respuesta.")
    with patch("app.services.lumi_chat_service.anthropic_client", mock_client2):
        lumi_chat_service.send_message(db, conv.id, user.id, "Segunda pregunta", "parent")

    call_messages = mock_client2.messages.create.call_args.kwargs["messages"]
    roles = [m["role"] for m in call_messages]
    assert roles == ["user", "assistant", "user"]


def test_send_message_claude_error_raises_503(db):
    user = _make_user(db, "err1@test.com")
    conv = lumi_chat_service.create_conversation(db, user.id)
    mock_client = MagicMock()
    mock_client.messages.create.side_effect = Exception("API down")

    with pytest.raises(HTTPException) as exc:
        with patch("app.services.lumi_chat_service.anthropic_client", mock_client):
            lumi_chat_service.send_message(db, conv.id, user.id, "Hola", "parent")
    assert exc.value.status_code == 503
