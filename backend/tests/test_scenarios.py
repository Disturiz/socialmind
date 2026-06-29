def test_list_scenarios(client):
    client.post("/api/v1/auth/register", json={
        "email": "padre_list@test.com", "password": "Password123!",
        "full_name": "Padre List", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={
        "email": "padre_list@test.com", "password": "Password123!",
    })
    token = login.json()["access_token"]
    response = client.get("/api/v1/scenarios", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5
    titles = [s["title"] for s in data]
    assert "Saludar" in titles
    assert "Hablar con un compañero" in titles
    assert "Pedir ayuda" in titles
    assert "Esperar turno" in titles
    assert "Manejar la frustración" in titles
    assert all("completed" in s for s in data)
    assert all(s["completed"] is False for s in data)


def test_get_scenario_detail(client):
    response = client.get("/api/v1/scenarios/1")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert data["title"] == "Saludar"
    assert len(data["steps"]) == 5
    step_types = [s["type"] for s in data["steps"]]
    assert step_types == ["objective", "explanation", "practice", "feedback", "closing"]


def test_get_scenario_practice_step_has_options(client):
    response = client.get("/api/v1/scenarios/1")
    data = response.json()
    practice_step = next(s for s in data["steps"] if s["type"] == "practice")
    assert "options" in practice_step
    assert len(practice_step["options"]) == 3
    correct_options = [o for o in practice_step["options"] if o["correct"]]
    assert len(correct_options) == 1


def test_get_scenario_not_found(client):
    response = client.get("/api/v1/scenarios/99")
    assert response.status_code == 404


def test_complete_scenario_authenticated(client):
    client.post("/api/v1/auth/register", json={
        "email": "padre3@test.com", "password": "Password123!", "full_name": "Padre 3", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={"email": "padre3@test.com", "password": "Password123!"})
    token = login.json()["access_token"]

    response = client.post(
        "/api/v1/scenarios/1/complete",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["scenario_id"] == 1
    assert "completed_at" in data


def test_complete_scenario_unauthenticated(client):
    response = client.post("/api/v1/scenarios/1/complete")
    assert response.status_code == 401


def test_complete_scenario_not_found(client):
    client.post("/api/v1/auth/register", json={
        "email": "padre4@test.com", "password": "Password123!", "full_name": "Padre 4", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={"email": "padre4@test.com", "password": "Password123!"})
    token = login.json()["access_token"]

    response = client.post(
        "/api/v1/scenarios/99/complete",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404


def test_list_scenarios_unauthenticated(client):
    response = client.get("/api/v1/scenarios")
    assert response.status_code == 401


def test_list_scenarios_shows_completed(client):
    client.post("/api/v1/auth/register", json={
        "email": "padre_comp@test.com", "password": "Password123!",
        "full_name": "Padre Comp", "role": "parent",
    })
    login = client.post("/api/v1/auth/login", json={
        "email": "padre_comp@test.com", "password": "Password123!",
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/v1/scenarios/1/complete", headers=headers)

    response = client.get("/api/v1/scenarios", headers=headers)
    data = response.json()
    scenario_1 = next(s for s in data if s["id"] == 1)
    scenario_2 = next(s for s in data if s["id"] == 2)
    assert scenario_1["completed"] is True
    assert scenario_2["completed"] is False
