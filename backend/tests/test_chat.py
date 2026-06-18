from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient


def _register_and_login(client, email="chat@test.com"):
    client.post("/api/v1/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Chat Test", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return login.json()["access_token"]


def _make_anthropic_mock(message="Hola, ¿cómo estás?", options=None, lumi_state="happy"):
    if options is None:
        options = ["Bien", "Regular", "Quiero hablar", "Terminar"]
    mock_tool = MagicMock()
    mock_tool.type = "tool_use"
    mock_tool.name = "respond_to_child"
    mock_tool.input = {"message": message, "options": options, "lumi_state": lumi_state}
    mock_resp = MagicMock()
    mock_resp.content = [mock_tool]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_resp
    return mock_client


def test_chat_start_creates_conversation_and_returns_lumi_message(client):
    token = _register_and_login(client, "start1@test.com")
    mock_anthropic = _make_anthropic_mock("Hola, veo que hoy te sentiste nervioso.")

    with patch("app.services.chat_service.anthropic_client", mock_anthropic):
        response = client.post(
            "/api/v1/chat/start",
            json={"emotion_key": "nervioso"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 201
    data = response.json()
    assert "conversation_id" in data
    assert data["message"] == "Hola, veo que hoy te sentiste nervioso."
    assert len(data["options"]) >= 3
    assert "Terminar" in data["options"]
    assert data["lumi_state"] in ("happy", "thinking", "encouraging", "idle")


def test_chat_start_passes_emotion_key_to_anthropic(client):
    token = _register_and_login(client, "start2@test.com")
    mock_anthropic = _make_anthropic_mock()

    with patch("app.services.chat_service.anthropic_client", mock_anthropic):
        client.post(
            "/api/v1/chat/start",
            json={"emotion_key": "frustrado"},
            headers={"Authorization": f"Bearer {token}"},
        )

    call_kwargs = mock_anthropic.messages.create.call_args
    system_prompt = call_kwargs.kwargs.get("system") or (call_kwargs.args[0] if call_kwargs.args else "")
    assert "frustrado" in system_prompt


def test_send_message_saves_both_messages_and_returns_response(client):
    token = _register_and_login(client, "msg1@test.com")
    mock_anthropic = _make_anthropic_mock()

    with patch("app.services.chat_service.anthropic_client", mock_anthropic):
        start = client.post(
            "/api/v1/chat/start",
            json={"emotion_key": "feliz"},
            headers={"Authorization": f"Bearer {token}"},
        )
        conv_id = start.json()["conversation_id"]

        mock_anthropic2 = _make_anthropic_mock("¡Qué bueno escuchar eso!", lumi_state="encouraging")
        with patch("app.services.chat_service.anthropic_client", mock_anthropic2):
            response = client.post(
                f"/api/v1/chat/{conv_id}/message",
                json={"content": "Bien"},
                headers={"Authorization": f"Bearer {token}"},
            )

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "¡Qué bueno escuchar eso!"
    assert data["ended"] is False

    conv_response = client.get(
        f"/api/v1/chat/{conv_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    messages = conv_response.json()["messages"]
    roles = [m["role"] for m in messages]
    assert roles.count("assistant") >= 2
    assert roles.count("user") >= 1


def test_send_message_on_closed_conversation_returns_409(client):
    token = _register_and_login(client, "closed1@test.com")
    mock_anthropic = _make_anthropic_mock()

    with patch("app.services.chat_service.anthropic_client", mock_anthropic):
        start = client.post(
            "/api/v1/chat/start",
            json={"emotion_key": "cansado"},
            headers={"Authorization": f"Bearer {token}"},
        )
        conv_id = start.json()["conversation_id"]
        client.post(
            f"/api/v1/chat/{conv_id}/message",
            json={"content": "Terminar"},
            headers={"Authorization": f"Bearer {token}"},
        )
        response = client.post(
            f"/api/v1/chat/{conv_id}/message",
            json={"content": "Hola de nuevo"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 409


def test_send_message_on_other_users_conversation_returns_404(client):
    token1 = _register_and_login(client, "owner@test.com")
    token2 = _register_and_login(client, "other@test.com")
    mock_anthropic = _make_anthropic_mock()

    with patch("app.services.chat_service.anthropic_client", mock_anthropic):
        start = client.post(
            "/api/v1/chat/start",
            json={"emotion_key": "confundido"},
            headers={"Authorization": f"Bearer {token1}"},
        )
        conv_id = start.json()["conversation_id"]

        response = client.post(
            f"/api/v1/chat/{conv_id}/message",
            json={"content": "Hola"},
            headers={"Authorization": f"Bearer {token2}"},
        )

    assert response.status_code == 404


def test_get_history_returns_last_10_conversations(client):
    token = _register_and_login(client, "history@test.com")
    mock_anthropic = _make_anthropic_mock()

    with patch("app.services.chat_service.anthropic_client", mock_anthropic):
        for i in range(3):
            client.post(
                "/api/v1/chat/start",
                json={"emotion_key": "feliz"},
                headers={"Authorization": f"Bearer {token}"},
            )

    response = client.get(
        "/api/v1/chat/history",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert "conversation_id" in data[0]
    assert "emotion_key" in data[0]
    assert "message_count" in data[0]


def test_get_conversation_returns_all_messages(client):
    token = _register_and_login(client, "getconv@test.com")
    mock_anthropic = _make_anthropic_mock()

    with patch("app.services.chat_service.anthropic_client", mock_anthropic):
        start = client.post(
            "/api/v1/chat/start",
            json={"emotion_key": "nervioso"},
            headers={"Authorization": f"Bearer {token}"},
        )
        conv_id = start.json()["conversation_id"]

    response = client.get(
        f"/api/v1/chat/{conv_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["conversation_id"] == conv_id
    assert data["emotion_key"] == "nervioso"
    assert len(data["messages"]) >= 1
    assert data["messages"][0]["role"] == "assistant"


def test_send_terminar_closes_conversation(client):
    token = _register_and_login(client, "terminar@test.com")
    mock_anthropic = _make_anthropic_mock()

    with patch("app.services.chat_service.anthropic_client", mock_anthropic):
        start = client.post(
            "/api/v1/chat/start",
            json={"emotion_key": "feliz"},
            headers={"Authorization": f"Bearer {token}"},
        )
        conv_id = start.json()["conversation_id"]

        response = client.post(
            f"/api/v1/chat/{conv_id}/message",
            json={"content": "Terminar"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["ended"] is True

    # Segunda llamada debe retornar 409
    with patch("app.services.chat_service.anthropic_client", mock_anthropic):
        response2 = client.post(
            f"/api/v1/chat/{conv_id}/message",
            json={"content": "Hola de nuevo"},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response2.status_code == 409


def test_send_message_anthropic_returns_no_tool_use_returns_fallback(client):
    token = _register_and_login(client, "fallback@test.com")
    mock_anthropic = _make_anthropic_mock()

    with patch("app.services.chat_service.anthropic_client", mock_anthropic):
        start = client.post(
            "/api/v1/chat/start",
            json={"emotion_key": "confundido"},
            headers={"Authorization": f"Bearer {token}"},
        )
        conv_id = start.json()["conversation_id"]

    # Mock que no devuelve tool_use block
    mock_no_tool = MagicMock()
    mock_no_tool.content = []  # lista vacía — next() devolvería None con el fix
    mock_client_no_tool = MagicMock()
    mock_client_no_tool.messages.create.return_value = mock_no_tool

    with patch("app.services.chat_service.anthropic_client", mock_client_no_tool):
        response = client.post(
            f"/api/v1/chat/{conv_id}/message",
            json={"content": "Hola"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert "problema técnico" in data["message"]
    assert "Reintentar" in data["options"]


def test_chat_search_library_injects_context(client, db):
    token = _register_and_login(client, "rag_search@test.com")

    search_block = MagicMock()
    search_block.type = "tool_use"
    search_block.name = "search_library"
    search_block.id = "tu_abc123"
    search_block.input = {"query": "autismo regulacion emocional"}

    search_response = MagicMock()
    search_response.content = [search_block]

    respond_block = MagicMock()
    respond_block.type = "tool_use"
    respond_block.name = "respond_to_child"
    respond_block.input = {
        "message": "Lo que sentís tiene mucho sentido.",
        "options": ["Contame más", "Cambiar tema", "Terminar"],
        "lumi_state": "happy",
    }

    final_response = MagicMock()
    final_response.content = [respond_block]

    with patch("app.services.chat_service.anthropic_client") as mock_anthropic, \
         patch("app.services.chat_service.biblioteca_service") as mock_bs:
        mock_anthropic.messages.create.side_effect = [search_response, final_response]
        mock_bs.search.return_value = "[Fragmento 1]: Texto educativo relevante."

        resp = client.post(
            "/api/v1/chat/start",
            json={"emotion_key": "confundido"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 201
    assert resp.json()["message"] == "Lo que sentís tiene mucho sentido."
    assert mock_anthropic.messages.create.call_count == 2
    mock_bs.search.assert_called_once()


def test_chat_no_search_needed_responds_directly(client, db):
    token = _register_and_login(client, "rag_no_search@test.com")

    respond_block = MagicMock()
    respond_block.type = "tool_use"
    respond_block.name = "respond_to_child"
    respond_block.input = {
        "message": "¡Qué bueno escucharte!",
        "options": ["Gracias", "Contame algo", "Terminar"],
        "lumi_state": "happy",
    }

    direct_response = MagicMock()
    direct_response.content = [respond_block]

    with patch("app.services.chat_service.anthropic_client") as mock_anthropic, \
         patch("app.services.chat_service.biblioteca_service") as mock_bs:
        mock_anthropic.messages.create.return_value = direct_response

        resp = client.post(
            "/api/v1/chat/start",
            json={"emotion_key": "feliz"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 201
    assert resp.json()["message"] == "¡Qué bueno escucharte!"
    assert mock_anthropic.messages.create.call_count == 1
    mock_bs.search.assert_not_called()
