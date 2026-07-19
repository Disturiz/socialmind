from sqlalchemy import text

from app.services.habitos_service import detect_file_type


def test_habit_infographics_table_exists(db):
    result = db.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name='habit_infographics'")
    )
    assert result.fetchone() is not None, "Tabla 'habit_infographics' no existe"


def test_detect_file_type_valid_pdf():
    assert detect_file_type("application/pdf", b"%PDF-1.4 fake content") == ("pdf", "pdf")


def test_detect_file_type_valid_png():
    body = b"\x89PNG\r\n\x1a\n" + b"restofpngbytes"
    assert detect_file_type("image/png", body) == ("image", "png")


def test_detect_file_type_valid_jpeg():
    body = b"\xff\xd8\xff" + b"restofjpegbytes"
    assert detect_file_type("image/jpeg", body) == ("image", "jpg")


def test_detect_file_type_valid_webp():
    body = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"restofwebpbytes"
    assert detect_file_type("image/webp", body) == ("image", "webp")


def test_detect_file_type_rejects_mismatched_signature():
    assert detect_file_type("application/pdf", b"this is not a real pdf") is None


def test_detect_file_type_rejects_unsupported_content_type():
    assert detect_file_type("application/zip", b"PK\x03\x04") is None


import io


def _login_habitos(client, email, role="specialist"):
    client.post("/api/v1/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Test User", "role": role,
    })
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return resp.json()["access_token"]


def _me_habitos(client, token):
    return client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()


def _login_admin_habitos(client, db, email="admin_habito_upload@test.com"):
    # register_user() restricts self-registration to parent/specialist (see
    # app/services/auth_service.py), matching the pattern in test_admin.py:
    # admin test users are inserted directly via the db fixture.
    from app.core.security import hash_password
    from app.models.user import User, UserRole

    user = User(
        email=email,
        hashed_password=hash_password("Password123!"),
        full_name="Test User",
        role=UserRole.admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return resp.json()["access_token"]


def test_upload_infographic_creates_record(client, tmp_path, monkeypatch):
    import app.services.habitos_service as hs
    monkeypatch.setattr(hs, "DATA_DIR", str(tmp_path))

    token = _login_habitos(client, "spec_habito_upload@test.com")
    files = {"file": ("saludo.png", io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"fakepngcontent"), "image/png")}
    data = {"title": "Cómo saludar", "category": "Saludar", "description": "Pasos simples"}
    response = client.post(
        "/api/v1/habitos/upload",
        files=files, data=data,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Cómo saludar"
    assert body["category"] == "Saludar"
    assert body["file_type"] == "image"
    assert body["original_name"] == "saludo.png"


def test_upload_infographic_pdf_admin_allowed(client, db, tmp_path, monkeypatch):
    import app.services.habitos_service as hs
    monkeypatch.setattr(hs, "DATA_DIR", str(tmp_path))

    token = _login_admin_habitos(client, db)
    files = {"file": ("guia.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")}
    data = {"title": "Guía en PDF", "category": "Esperar turno"}
    response = client.post(
        "/api/v1/habitos/upload",
        files=files, data=data,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    assert response.json()["file_type"] == "pdf"


def test_upload_infographic_invalid_type_returns_422(client):
    token = _login_habitos(client, "spec_habito_badtype@test.com")
    files = {"file": ("archivo.zip", io.BytesIO(b"PK\x03\x04"), "application/zip")}
    data = {"title": "Test", "category": "Otros"}
    response = client.post(
        "/api/v1/habitos/upload",
        files=files, data=data,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def test_upload_infographic_bad_signature_returns_422(client):
    token = _login_habitos(client, "spec_habito_badsig@test.com")
    files = {"file": ("fake.png", io.BytesIO(b"this is not a real png"), "image/png")}
    data = {"title": "Test", "category": "Otros"}
    response = client.post(
        "/api/v1/habitos/upload",
        files=files, data=data,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def test_upload_infographic_too_large_returns_413(client, tmp_path, monkeypatch):
    import app.services.habitos_service as hs
    monkeypatch.setattr(hs, "DATA_DIR", str(tmp_path))

    token = _login_habitos(client, "spec_habito_toolarge@test.com")
    large_bytes = b"\x89PNG\r\n\x1a\n" + b"X" * (10 * 1024 * 1024 + 1)
    files = {"file": ("big.png", io.BytesIO(large_bytes), "image/png")}
    data = {"title": "Test", "category": "Otros"}
    response = client.post(
        "/api/v1/habitos/upload",
        files=files, data=data,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 413


def test_upload_infographic_parent_role_returns_403(client):
    token = _login_habitos(client, "parent_habito_noupload@test.com", role="parent")
    files = {"file": ("saludo.png", io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"fakepngcontent"), "image/png")}
    data = {"title": "Test", "category": "Otros"}
    response = client.post(
        "/api/v1/habitos/upload",
        files=files, data=data,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


def test_list_infographics_returns_all(client, db):
    spec_token = _login_habitos(client, "spec_habito_list@test.com")
    parent_token = _login_habitos(client, "parent_habito_list@test.com", role="parent")
    spec_id = _me_habitos(client, spec_token)["id"]

    from datetime import datetime, timezone
    from app.models.habit_infographic import HabitInfographic
    for i, cat in enumerate(["Saludar", "Esperar turno"]):
        db.add(HabitInfographic(
            uploaded_by=spec_id,
            title=f"Infografía {i}",
            description=None,
            category=cat,
            file_type="image",
            filename=f"f{i}.png",
            original_name=f"f{i}.png",
            mime_type="image/png",
            file_size_bytes=100,
            created_at=datetime.now(timezone.utc),
        ))
    db.commit()

    for token in [spec_token, parent_token]:
        response = client.get("/api/v1/habitos", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        assert len(response.json()) == 2


def test_list_infographics_filters_by_category(client, db):
    token = _login_habitos(client, "spec_habito_filter@test.com")
    spec_id = _me_habitos(client, token)["id"]

    from datetime import datetime, timezone
    from app.models.habit_infographic import HabitInfographic
    for i, cat in enumerate(["Saludar", "Esperar turno"]):
        db.add(HabitInfographic(
            uploaded_by=spec_id,
            title=f"Infografía {i}",
            description=None,
            category=cat,
            file_type="image",
            filename=f"f{i}.png",
            original_name=f"f{i}.png",
            mime_type="image/png",
            file_size_bytes=100,
            created_at=datetime.now(timezone.utc),
        ))
    db.commit()

    response = client.get(
        "/api/v1/habitos",
        params={"category": "Saludar"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["category"] == "Saludar"


def test_get_categorias_returns_distinct_sorted(client, db):
    token = _login_habitos(client, "spec_habito_cats@test.com")
    spec_id = _me_habitos(client, token)["id"]

    from datetime import datetime, timezone
    from app.models.habit_infographic import HabitInfographic
    for cat in ["Saludar", "Esperar turno", "Saludar"]:
        db.add(HabitInfographic(
            uploaded_by=spec_id,
            title="Infografía",
            description=None,
            category=cat,
            file_type="image",
            filename="f.png",
            original_name="f.png",
            mime_type="image/png",
            file_size_bytes=100,
            created_at=datetime.now(timezone.utc),
        ))
    db.commit()

    response = client.get("/api/v1/habitos/categorias", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == ["Esperar turno", "Saludar"]
