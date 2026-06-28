def _register_parent(client):
    r = client.post("/api/v1/auth/register", json={
        "email": "padre@example.com",
        "password": "Password123!",
        "full_name": "Juan García",
        "role": "parent",
    })
    return r.json()["access_token"]


def _register_specialist(client):
    r = client.post("/api/v1/auth/register", json={
        "email": "esp@example.com",
        "password": "Password123!",
        "full_name": "Dra. Ana",
        "role": "specialist",
    })
    return r.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


VALID_CHILD = {"name": "Sofía", "age": 7, "avatar_emoji": "🦋"}


def test_get_me_no_child(client):
    token = _register_parent(client)
    r = client.get("/api/v1/profiles/me", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["child"] is None


def test_create_child_success(client):
    token = _register_parent(client)
    r = client.post("/api/v1/profiles/children", json=VALID_CHILD, headers=_auth(token))
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Sofía"
    assert data["age"] == 7
    assert data["avatar_emoji"] == "🦋"
    assert "id" in data
    assert "created_at" in data


def test_get_me_with_child(client):
    token = _register_parent(client)
    client.post("/api/v1/profiles/children", json=VALID_CHILD, headers=_auth(token))
    r = client.get("/api/v1/profiles/me", headers=_auth(token))
    assert r.status_code == 200
    child = r.json()["child"]
    assert child["name"] == "Sofía"
    assert child["age"] == 7
    assert child["avatar_emoji"] == "🦋"


def test_create_child_duplicate(client):
    token = _register_parent(client)
    client.post("/api/v1/profiles/children", json=VALID_CHILD, headers=_auth(token))
    r = client.post("/api/v1/profiles/children", json=VALID_CHILD, headers=_auth(token))
    assert r.status_code == 409
    assert "Ya tienes" in r.json()["detail"]


def test_create_child_invalid_age_zero(client):
    token = _register_parent(client)
    r = client.post("/api/v1/profiles/children",
                    json={"name": "Niño", "age": 0, "avatar_emoji": "🌟"},
                    headers=_auth(token))
    assert r.status_code == 422


def test_create_child_invalid_age_eighteen(client):
    token = _register_parent(client)
    r = client.post("/api/v1/profiles/children",
                    json={"name": "Niño", "age": 18, "avatar_emoji": "🌟"},
                    headers=_auth(token))
    assert r.status_code == 422


def test_create_child_invalid_avatar(client):
    token = _register_parent(client)
    r = client.post("/api/v1/profiles/children",
                    json={"name": "Niño", "age": 7, "avatar_emoji": "🚀"},
                    headers=_auth(token))
    assert r.status_code == 422


def test_create_child_empty_name(client):
    token = _register_parent(client)
    r = client.post("/api/v1/profiles/children",
                    json={"name": "   ", "age": 7, "avatar_emoji": "🌟"},
                    headers=_auth(token))
    assert r.status_code == 422


def test_create_child_specialist_forbidden(client):
    token = _register_specialist(client)
    r = client.post("/api/v1/profiles/children", json=VALID_CHILD, headers=_auth(token))
    assert r.status_code == 403


def test_get_me_specialist_forbidden(client):
    token = _register_specialist(client)
    r = client.get("/api/v1/profiles/me", headers=_auth(token))
    assert r.status_code == 403


def test_create_child_unauthenticated(client):
    r = client.post("/api/v1/profiles/children", json=VALID_CHILD)
    assert r.status_code == 401
