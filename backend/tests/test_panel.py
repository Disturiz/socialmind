import pytest
from fastapi.testclient import TestClient
from app.models.child_profile import ChildProfile
from app.models.emotion_log import EmotionLog
from app.models.calm_session import CalmSession
from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage
from app.models.specialist_assignment import SpecialistAssignment
from datetime import datetime, timezone


def _login(client, email, role="parent"):
    client.post("/api/v1/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Test User", "role": role,
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


def _assign_child(db, specialist_id, child_profile_id):
    a = SpecialistAssignment(
        specialist_id=specialist_id,
        child_profile_id=child_profile_id,
        assigned_at=datetime.now(timezone.utc),
    )
    db.add(a)
    db.commit()


def test_list_children_returns_child_profiles(client, db):
    spec_token = _login(client, "spec1@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    parent_token = _login(client, "parent1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id, name="Juan", age=10)
    _assign_child(db, spec_id, child.id)

    response = client.get(
        "/api/v1/panel/children",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Juan"
    assert data[0]["age"] == 10
    assert data[0]["avatar_emoji"] == "⭐"
    assert data[0]["total_calm_sessions"] == 0
    assert data[0]["total_chats"] == 0


def test_list_children_parent_role_returns_403(client):
    parent_token = _login(client, "parent2@test.com", "parent")
    response = client.get(
        "/api/v1/panel/children",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert response.status_code == 403


def test_list_children_unauthenticated_returns_401(client):
    response = client.get("/api/v1/panel/children")
    assert response.status_code == 401


def test_get_child_detail_returns_emotions_calm_chats(client, db):
    from datetime import datetime, timezone
    spec_token = _login(client, "spec2@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    parent_token = _login(client, "parent3@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id, name="Ana", age=12)
    _assign_child(db, spec_id, child.id)
    now = datetime.now(timezone.utc)

    db.add(EmotionLog(user_id=parent_id, emotion_key="feliz", logged_at=now))
    db.add(CalmSession(user_id=parent_id, activity_type="respirar",
                       duration_seconds=40, emotion_key="feliz", created_at=now))
    conv = ChatConversation(user_id=parent_id, emotion_key="feliz", started_at=now)
    db.add(conv)
    db.flush()
    db.add(ChatMessage(conversation_id=conv.id, role="assistant",
                       content="Hola", created_at=now))
    db.commit()

    response = client.get(
        f"/api/v1/panel/children/{child.id}",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Ana"
    assert len(data["emotions"]) == 1
    assert data["emotions"][0]["emotion_key"] == "feliz"
    assert len(data["calm_sessions"]) == 1
    assert data["calm_sessions"][0]["activity_type"] == "respirar"
    assert len(data["conversations"]) == 1
    assert len(data["conversations"][0]["messages"]) == 1
    assert data["specialist_note"] is None


def test_get_child_detail_other_specialist_sees_same_child(client, db):
    spec1_token = _login(client, "spec3@test.com", "specialist")
    spec1_id = _me(client, spec1_token)["id"]
    spec2_token = _login(client, "spec4@test.com", "specialist")
    spec2_id = _me(client, spec2_token)["id"]
    parent_token = _login(client, "parent4@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id, name="Pedro", age=9)
    _assign_child(db, spec1_id, child.id)
    _assign_child(db, spec2_id, child.id)

    r1 = client.get(f"/api/v1/panel/children/{child.id}",
                    headers={"Authorization": f"Bearer {spec1_token}"})
    r2 = client.get(f"/api/v1/panel/children/{child.id}",
                    headers={"Authorization": f"Bearer {spec2_token}"})
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["name"] == r2.json()["name"] == "Pedro"


def test_get_child_detail_nonexistent_returns_404(client):
    spec_token = _login(client, "spec5@test.com", "specialist")
    response = client.get(
        "/api/v1/panel/children/9999",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert response.status_code == 404


def test_save_note_creates_note(client, db):
    spec_token = _login(client, "spec6@test.com", "specialist")
    parent_token = _login(client, "parent5@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id)

    response = client.put(
        f"/api/v1/panel/children/{child.id}/note",
        json={"content": "Juan muestra progreso excelente."},
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "Juan muestra progreso excelente."
    assert "updated_at" in data


def test_save_note_updates_existing_note(client, db):
    spec_token = _login(client, "spec7@test.com", "specialist")
    parent_token = _login(client, "parent6@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id)

    client.put(
        f"/api/v1/panel/children/{child.id}/note",
        json={"content": "Nota inicial."},
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    response = client.put(
        f"/api/v1/panel/children/{child.id}/note",
        json={"content": "Nota actualizada."},
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert response.status_code == 200
    assert response.json()["content"] == "Nota actualizada."

    # Solo una nota en DB (upsert)
    from app.models.specialist_note import SpecialistNote
    count = db.query(SpecialistNote).count()
    assert count == 1


def test_save_note_parent_role_returns_403(client, db):
    parent_token = _login(client, "parent7@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id)

    response = client.put(
        f"/api/v1/panel/children/{child.id}/note",
        json={"content": "Intento no autorizado."},
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert response.status_code == 403


def _make_admin(db, email="admin_test@test.com"):
    from app.models.user import User, UserRole
    from app.core.security import hash_password, create_access_token
    user = User(
        email=email,
        hashed_password=hash_password("Password123!"),
        full_name="Admin Test",
        role=UserRole.admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return token


def test_list_children_admin_role_returns_403(client, db):
    admin_token = _make_admin(db, "admin1@test.com")
    response = client.get(
        "/api/v1/panel/children",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 403


def test_save_note_admin_role_returns_403(client, db):
    admin_token = _make_admin(db, "admin2@test.com")
    parent_token = _login(client, "parent8@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id)

    response = client.put(
        f"/api/v1/panel/children/{child.id}/note",
        json={"content": "Intento admin."},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 403


def test_child_detail_includes_gamification(client, db):
    from app.core.security import hash_password
    from app.models.user import User, UserRole
    from app.models.child_profile import ChildProfile

    spec = User(
        email="spec_gami@test.com",
        hashed_password=hash_password("Password123!"),
        full_name="Spec", role=UserRole.specialist,
    )
    padre = User(
        email="padre_gami@test.com",
        hashed_password=hash_password("Password123!"),
        full_name="Padre", role=UserRole.parent,
    )
    db.add_all([spec, padre])
    db.commit()

    child = ChildProfile(parent_id=padre.id, name="Niño Test", age=10, avatar_emoji="🌟")
    db.add(child)
    db.commit()
    db.refresh(child)

    _assign_child(db, spec.id, child.id)

    spec_login = client.post(
        "/api/v1/auth/login",
        json={"email": "spec_gami@test.com", "password": "Password123!"},
    )
    spec_token = spec_login.json()["access_token"]

    r = client.get(
        f"/api/v1/panel/children/{child.id}",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "gamification_progress" in data
    assert data["gamification_progress"]["total_stars"] == 0
    assert data["gamification_progress"]["level_key"] == "explorador"


def test_child_detail_includes_scenarios_completed(client, db):
    from datetime import datetime, timezone
    from app.models.scenario_completion import ScenarioCompletion

    spec_token = _login(client, "spec_sc1@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    parent_token = _login(client, "parent_sc1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id, name="María", age=11)
    _assign_child(db, spec_id, child.id)
    now = datetime.now(timezone.utc)

    db.add(ScenarioCompletion(user_id=parent_id, scenario_id=1, completed_at=now))
    db.commit()

    response = client.get(
        f"/api/v1/panel/children/{child.id}",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "scenarios_completed" in data
    assert len(data["scenarios_completed"]) == 1
    sc = data["scenarios_completed"][0]
    assert sc["scenario_id"] == 1
    assert sc["emoji"]
    assert sc["title"]
    assert "completed_at" in sc


def test_list_children_includes_total_scenarios_completed(client, db):
    from app.models.scenario_completion import ScenarioCompletion

    spec_token = _login(client, "spec_sc2@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    parent_token = _login(client, "parent_sc2@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id, name="Sofía", age=9)
    _assign_child(db, spec_id, child.id)

    db.add(ScenarioCompletion(user_id=parent_id, scenario_id=1))
    db.add(ScenarioCompletion(user_id=parent_id, scenario_id=2))
    db.commit()

    response = client.get(
        "/api/v1/panel/children",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["total_scenarios_completed"] == 2


def test_list_children_only_shows_assigned_children(client, db):
    spec_token = _login(client, "spec_filter1@test.com", "specialist")
    spec_id = _me(client, spec_token)["id"]
    parent_token = _login(client, "parent_filter1@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child1 = _make_child(db, parent_id, name="Asignado", age=10)
    _make_child(db, parent_id, name="NoAsignado", age=11)
    _assign_child(db, spec_id, child1.id)

    response = client.get(
        "/api/v1/panel/children",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Asignado"


def test_get_child_detail_not_assigned_returns_403(client, db):
    spec_token = _login(client, "spec_403@test.com", "specialist")
    parent_token = _login(client, "parent_403@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    child = _make_child(db, parent_id, name="Bloqueado", age=9)

    response = client.get(
        f"/api/v1/panel/children/{child.id}",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert response.status_code == 403


def test_list_children_empty_if_no_assignments(client, db):
    spec_token = _login(client, "spec_empty@test.com", "specialist")
    parent_token = _login(client, "parent_empty@test.com", "parent")
    parent_id = _me(client, parent_token)["id"]
    _make_child(db, parent_id, name="Tomás", age=10)

    response = client.get(
        "/api/v1/panel/children",
        headers={"Authorization": f"Bearer {spec_token}"},
    )
    assert response.status_code == 200
    assert response.json() == []
