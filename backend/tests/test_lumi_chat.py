from unittest.mock import MagicMock, patch


def _login(client, email, role="parent"):
    client.post("/api/v1/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Test", "role": role, "terms_accepted": True,
    })
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return resp.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _mock_claude(text="Hola, soy Lumi."):
    block = MagicMock()
    block.text = text
    resp = MagicMock()
    resp.content = [block]
    client = MagicMock()
    client.messages.create.return_value = resp
    return client


def test_create_conversation_returns_201_and_id(client):
    token = _login(client, "cc1@test.com")
    resp = client.post("/api/v1/lumi-chat/conversations", headers=_auth(token))
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
    assert "started_at" in data


def test_create_conversation_unauthenticated_returns_401(client):
    resp = client.post("/api/v1/lumi-chat/conversations")
    assert resp.status_code == 401


def test_send_message_returns_201_with_assistant_reply(client):
    token = _login(client, "sm2@test.com")
    conv = client.post("/api/v1/lumi-chat/conversations", headers=_auth(token)).json()

    with patch("app.services.lumi_chat_service.anthropic_client", _mock_claude("¡Claro!")):
        resp = client.post(
            f"/api/v1/lumi-chat/conversations/{conv['id']}/messages",
            json={"content": "Hola Lumi"},
            headers=_auth(token),
        )

    assert resp.status_code == 201
    data = resp.json()
    assert data["role"] == "assistant"
    assert data["content"] == "¡Claro!"
    assert "id" in data
    assert "created_at" in data


def test_send_message_to_foreign_conversation_returns_404(client):
    token1 = _login(client, "fgn1@test.com")
    token2 = _login(client, "fgn2@test.com")
    conv = client.post("/api/v1/lumi-chat/conversations", headers=_auth(token1)).json()

    with patch("app.services.lumi_chat_service.anthropic_client", _mock_claude()):
        resp = client.post(
            f"/api/v1/lumi-chat/conversations/{conv['id']}/messages",
            json={"content": "Hola"},
            headers=_auth(token2),
        )
    assert resp.status_code == 404


def test_send_empty_message_returns_422(client):
    token = _login(client, "emp1@test.com")
    conv = client.post("/api/v1/lumi-chat/conversations", headers=_auth(token)).json()
    resp = client.post(
        f"/api/v1/lumi-chat/conversations/{conv['id']}/messages",
        json={"content": ""},
        headers=_auth(token),
    )
    assert resp.status_code == 422


def test_send_message_over_2000_chars_returns_422(client):
    token = _login(client, "long1@test.com")
    conv = client.post("/api/v1/lumi-chat/conversations", headers=_auth(token)).json()
    resp = client.post(
        f"/api/v1/lumi-chat/conversations/{conv['id']}/messages",
        json={"content": "x" * 2001},
        headers=_auth(token),
    )
    assert resp.status_code == 422


def test_send_message_when_claude_fails_returns_503(client):
    token = _login(client, "err2@test.com")
    conv = client.post("/api/v1/lumi-chat/conversations", headers=_auth(token)).json()
    bad_client = MagicMock()
    bad_client.messages.create.side_effect = Exception("timeout")

    with patch("app.services.lumi_chat_service.anthropic_client", bad_client):
        resp = client.post(
            f"/api/v1/lumi-chat/conversations/{conv['id']}/messages",
            json={"content": "Hola"},
            headers=_auth(token),
        )
    assert resp.status_code == 503


def test_get_conversation_returns_messages(client):
    token = _login(client, "gc2@test.com")
    conv = client.post("/api/v1/lumi-chat/conversations", headers=_auth(token)).json()

    with patch("app.services.lumi_chat_service.anthropic_client", _mock_claude("Respuesta.")):
        client.post(
            f"/api/v1/lumi-chat/conversations/{conv['id']}/messages",
            json={"content": "Pregunta"},
            headers=_auth(token),
        )

    resp = client.get(
        f"/api/v1/lumi-chat/conversations/{conv['id']}",
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == conv["id"]
    assert len(data["messages"]) == 2
    assert data["messages"][0]["role"] == "user"
    assert data["messages"][1]["role"] == "assistant"


def test_get_foreign_conversation_returns_404(client):
    token1 = _login(client, "fg2a@test.com")
    token2 = _login(client, "fg2b@test.com")
    conv = client.post("/api/v1/lumi-chat/conversations", headers=_auth(token1)).json()
    resp = client.get(
        f"/api/v1/lumi-chat/conversations/{conv['id']}",
        headers=_auth(token2),
    )
    assert resp.status_code == 404


def test_specialist_can_create_and_send(client):
    token = _login(client, "spec2@test.com", role="specialist")
    conv = client.post("/api/v1/lumi-chat/conversations", headers=_auth(token)).json()
    assert conv["id"] is not None

    with patch("app.services.lumi_chat_service.anthropic_client", _mock_claude("Datos clínicos.")):
        resp = client.post(
            f"/api/v1/lumi-chat/conversations/{conv['id']}/messages",
            json={"content": "¿Qué es el TEA?"},
            headers=_auth(token),
        )
    assert resp.status_code == 201
    assert resp.json()["content"] == "Datos clínicos."
