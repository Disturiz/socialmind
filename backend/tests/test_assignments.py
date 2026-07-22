import pytest
from app.models.child_profile import ChildProfile


def _login(client, email, role="parent"):
    client.post("/api/v1/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Test User", "role": role, "terms_accepted": True,
    })
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return resp.json()["access_token"]


def _me(client, token):
    return client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()


def _make_child(db, parent_id, name="Juan", age=10):
    child = ChildProfile(parent_id=parent_id, name=name, age=age, avatar_emoji="⭐")
    db.add(child)
    db.commit()
    db.refresh(child)
    return child


def test_list_specialists_returns_all_active_specialists(client, db):
    parent_token = _login(client, "parent_a1@test.com", "parent")
    _login(client, "spec_a1@test.com", "specialist")
    _login(client, "spec_a2@test.com", "specialist")

    resp = client.get(
        "/api/v1/assignments/specialists",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    emails = {d["email"] for d in data}
    assert "spec_a1@test.com" in emails
    assert "spec_a2@test.com" in emails


def test_list_specialists_specialist_role_returns_403(client):
    spec_token = _login(client, "spec_b1@test.com", "specialist")
    resp = client.get(
        "/api/v1/assignments/specialists",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert resp.status_code == 403


def test_assign_creates_assignment(client, db):
    parent_token = _login(client, "parent_c1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    spec_token = _login(client, "spec_c1@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    child = _make_child(db, parent_id)

    resp = client.post(
        f"/api/v1/assignments/children/{child.id}/specialists/{spec_id}",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["specialist_id"] == spec_id
    assert data["child_profile_id"] == child.id
    assert "assigned_at" in data


def test_assign_duplicate_returns_409(client, db):
    parent_token = _login(client, "parent_d1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    spec_token = _login(client, "spec_d1@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    child = _make_child(db, parent_id)

    client.post(
        f"/api/v1/assignments/children/{child.id}/specialists/{spec_id}",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    resp = client.post(
        f"/api/v1/assignments/children/{child.id}/specialists/{spec_id}",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert resp.status_code == 409


def test_assign_other_parents_child_returns_404(client, db):
    parent1_token = _login(client, "parent_e1@test.com", "parent")
    parent1_id = _me(client, parent1_token)["id"]
    parent2_token = _login(client, "parent_e2@test.com", "parent")
    spec_token = _login(client, "spec_e1@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    child = _make_child(db, parent1_id)

    resp = client.post(
        f"/api/v1/assignments/children/{child.id}/specialists/{spec_id}",
        headers={"Authorization": f"Bearer {parent2_token}"},
    )
    assert resp.status_code == 404


def test_assign_nonexistent_specialist_returns_404(client, db):
    parent_token = _login(client, "parent_f1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id)

    resp = client.post(
        f"/api/v1/assignments/children/{child.id}/specialists/9999",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert resp.status_code == 404


def test_unassign_removes_assignment(client, db):
    parent_token = _login(client, "parent_g1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    spec_token = _login(client, "spec_g1@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    child = _make_child(db, parent_id)

    client.post(
        f"/api/v1/assignments/children/{child.id}/specialists/{spec_id}",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    resp = client.delete(
        f"/api/v1/assignments/children/{child.id}/specialists/{spec_id}",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert resp.status_code == 204

    listed = client.get(
        f"/api/v1/assignments/children/{child.id}/specialists",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert listed.json() == []


def test_unassign_nonexistent_returns_404(client, db):
    parent_token = _login(client, "parent_h1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    spec_token = _login(client, "spec_h1@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    child = _make_child(db, parent_id)

    resp = client.delete(
        f"/api/v1/assignments/children/{child.id}/specialists/{spec_id}",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert resp.status_code == 404


def test_get_assigned_specialists_returns_list(client, db):
    parent_token = _login(client, "parent_i1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    spec_token = _login(client, "spec_i1@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    child = _make_child(db, parent_id)

    client.post(
        f"/api/v1/assignments/children/{child.id}/specialists/{spec_id}",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    resp = client.get(
        f"/api/v1/assignments/children/{child.id}/specialists",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["id"] == spec_id
    assert data[0]["email"] == "spec_i1@test.com"


def test_my_parents_returns_parents_who_assigned(client, db):
    parent_token = _login(client, "parent_j1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    spec_token = _login(client, "spec_j1@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    child = _make_child(db, parent_id)

    client.post(
        f"/api/v1/assignments/children/{child.id}/specialists/{spec_id}",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    resp = client.get(
        "/api/v1/assignments/my-parents",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["id"] == parent_id


def test_my_parents_no_assignments_returns_empty(client):
    spec_token = _login(client, "spec_k1@test.com", "specialist")
    resp = client.get(
        "/api/v1/assignments/my-parents",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert resp.status_code == 200
    assert resp.json() == []


def test_my_parents_parent_role_returns_403(client):
    parent_token = _login(client, "parent_l1@test.com", "parent")
    resp = client.get(
        "/api/v1/assignments/my-parents",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert resp.status_code == 403
