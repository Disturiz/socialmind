def _register_and_login(client, email="gami_ep@test.com"):
    client.post("/api/v1/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Gami", "role": "parent", "terms_accepted": True,
    })
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return r.json()["access_token"]


def test_get_progress_authenticated_returns_structure(client):
    token = _register_and_login(client)
    r = client.get("/api/v1/gamification/progreso",
                   headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    assert data["total_stars"] == 0
    assert data["current_streak"] == 0
    assert data["level"]["key"] == "explorador"
    assert len(data["badges"]) == 13
    assert not any(b["earned"] for b in data["badges"])


def test_get_progress_unauthenticated_returns_401(client):
    r = client.get("/api/v1/gamification/progreso")
    assert r.status_code == 401


def test_complete_scenario_awards_stars_and_badge(client):
    token = _register_and_login(client, "integration@test.com")
    headers = {"Authorization": f"Bearer {token}"}
    client.post("/api/v1/scenarios/1/complete", headers=headers)
    r = client.get("/api/v1/gamification/progreso", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["total_stars"] > 0
    earned_keys = [b["key"] for b in data["badges"] if b["earned"]]
    assert "primer_paso" in earned_keys
