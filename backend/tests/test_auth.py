def test_register_parent(client):
    response = client.post("/api/v1/auth/register", json={
        "email": "padre@example.com",
        "password": "Password123!",
        "full_name": "Juan García",
        "role": "parent",
    })
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "parent"
    assert data["full_name"] == "Juan García"


def test_register_specialist(client):
    response = client.post("/api/v1/auth/register", json={
        "email": "psicologo@example.com",
        "password": "Password123!",
        "full_name": "Dra. Ana López",
        "role": "specialist",
    })
    assert response.status_code == 201
    assert response.json()["role"] == "specialist"


def test_register_invalid_role(client):
    response = client.post("/api/v1/auth/register", json={
        "email": "nino@example.com",
        "password": "Password123!",
        "full_name": "Niño Test",
        "role": "child",
    })
    assert response.status_code == 422


def test_register_duplicate_email(client):
    payload = {"email": "padre@example.com", "password": "Password123!", "full_name": "Test", "role": "parent"}
    client.post("/api/v1/auth/register", json=payload)
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert "correo electrónico" in response.json()["detail"]


def test_login_valid(client):
    client.post("/api/v1/auth/register", json={
        "email": "padre@example.com", "password": "Password123!", "full_name": "Juan", "role": "parent",
    })
    response = client.post("/api/v1/auth/login", json={
        "email": "padre@example.com", "password": "Password123!",
    })
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_wrong_password(client):
    client.post("/api/v1/auth/register", json={
        "email": "padre@example.com", "password": "Password123!", "full_name": "Juan", "role": "parent",
    })
    response = client.post("/api/v1/auth/login", json={
        "email": "padre@example.com", "password": "ClaveIncorrecta",
    })
    assert response.status_code == 401


def test_login_unknown_email(client):
    response = client.post("/api/v1/auth/login", json={
        "email": "noexiste@example.com", "password": "Password123!",
    })
    assert response.status_code == 401


def test_get_me_authenticated(client):
    client.post("/api/v1/auth/register", json={
        "email": "padre@example.com", "password": "Password123!", "full_name": "Juan García", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={"email": "padre@example.com", "password": "Password123!"})
    token = login.json()["access_token"]
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "padre@example.com"


def test_get_me_unauthenticated(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_get_me_invalid_token(client):
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer token_invalido"})
    assert response.status_code == 401


def test_register_admin_role_rejected(client):
    response = client.post("/api/v1/auth/register", json={
        "email": "admin@example.com",
        "password": "Password123!",
        "full_name": "Admin Malicioso",
        "role": "admin",
    })
    assert response.status_code == 400
    assert "no está permitido" in response.json()["detail"]


def test_register_short_password(client):
    response = client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "short",
        "full_name": "Test User",
        "role": "parent",
    })
    assert response.status_code == 422
