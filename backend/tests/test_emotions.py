def test_list_emotions(client):
    response = client.get("/api/v1/emotions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5
    keys = [e["key"] for e in data]
    assert "feliz" in keys
    assert "nervioso" in keys
    assert "confundido" in keys
    assert "frustrado" in keys
    assert "cansado" in keys


def test_log_emotion_authenticated(client):
    client.post("/api/v1/auth/register", json={
        "email": "padre@test.com", "password": "Password123!", "full_name": "Padre Test", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={"email": "padre@test.com", "password": "Password123!"})
    token = login.json()["access_token"]

    response = client.post(
        "/api/v1/emotions/log",
        json={"emotion_key": "feliz"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["emotion_key"] == "feliz"
    assert "logged_at" in data


def test_log_emotion_unauthenticated(client):
    response = client.post("/api/v1/emotions/log", json={"emotion_key": "feliz"})
    assert response.status_code == 401


def test_log_emotion_invalid_key(client):
    client.post("/api/v1/auth/register", json={
        "email": "padre2@test.com", "password": "Password123!", "full_name": "Padre 2", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={"email": "padre2@test.com", "password": "Password123!"})
    token = login.json()["access_token"]

    response = client.post(
        "/api/v1/emotions/log",
        json={"emotion_key": "enojado_invalido"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400


def test_emotions_today_returns_latest_emotion(client):
    client.post("/api/v1/auth/register", json={
        "email": "today1@test.com", "password": "Password123!", "full_name": "Hoy Test", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={"email": "today1@test.com", "password": "Password123!"})
    token = login.json()["access_token"]

    client.post(
        "/api/v1/emotions/log",
        json={"emotion_key": "nervioso"},
        headers={"Authorization": f"Bearer {token}"},
    )

    response = client.get(
        "/api/v1/emotions/today",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["emotion_key"] == "nervioso"


def test_emotions_today_returns_null_when_no_log_today(client):
    client.post("/api/v1/auth/register", json={
        "email": "today2@test.com", "password": "Password123!", "full_name": "Sin Log", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={"email": "today2@test.com", "password": "Password123!"})
    token = login.json()["access_token"]

    response = client.get(
        "/api/v1/emotions/today",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["emotion_key"] is None
