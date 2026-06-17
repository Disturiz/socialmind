from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient


def _register_and_login(client, email="calm@test.com"):
    client.post("/api/v1/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Calm Test", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return login.json()["access_token"]


def _make_phrase_mock(phrase="Todo va a estar bien."):
    mock_content = MagicMock()
    mock_content.text = phrase
    mock_resp = MagicMock()
    mock_resp.content = [mock_content]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_resp
    return mock_client


def test_save_session_creates_record(client):
    token = _register_and_login(client, "calm1@test.com")
    response = client.post(
        "/api/v1/calma/session",
        json={"activity_type": "respirar", "duration_seconds": 40, "emotion_key": "nervioso"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["activity_type"] == "respirar"
    assert data["duration_seconds"] == 40
    assert data["emotion_key"] == "nervioso"
    assert "id" in data
    assert "created_at" in data


def test_save_session_invalid_activity_type_returns_422(client):
    token = _register_and_login(client, "calm2@test.com")
    response = client.post(
        "/api/v1/calma/session",
        json={"activity_type": "descanso", "duration_seconds": 10, "emotion_key": "feliz"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def test_save_session_unauthenticated_returns_401(client):
    response = client.post(
        "/api/v1/calma/session",
        json={"activity_type": "pausa", "duration_seconds": 60, "emotion_key": "cansado"},
    )
    assert response.status_code == 401


def test_get_phrase_returns_lumi_phrase(client):
    token = _register_and_login(client, "calm3@test.com")
    mock_anthropic = _make_phrase_mock("Respira despacio y todo mejora.")

    with patch("app.services.calm_service.anthropic_calm_client", mock_anthropic):
        response = client.post(
            "/api/v1/calma/phrase",
            json={"emotion_key": "nervioso"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json()["phrase"] == "Respira despacio y todo mejora."


def test_get_phrase_anthropic_failure_returns_fallback(client):
    token = _register_and_login(client, "calm4@test.com")
    mock_client = MagicMock()
    mock_client.messages.create.side_effect = Exception("API error")

    with patch("app.services.calm_service.anthropic_calm_client", mock_client):
        response = client.post(
            "/api/v1/calma/phrase",
            json={"emotion_key": "triste"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json()["phrase"] == "Estás bien. Respira. Todo va a estar bien."


def test_get_phrase_unauthenticated_returns_401(client):
    response = client.post(
        "/api/v1/calma/phrase",
        json={"emotion_key": "feliz"},
    )
    assert response.status_code == 401
