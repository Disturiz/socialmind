import pytest
from unittest.mock import MagicMock, patch
import io
from sqlalchemy import text


def _login(client, email, role="specialist"):
    client.post("/api/v1/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Test User", "role": role, "terms_accepted": True,
    })
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return resp.json()["access_token"]


def _me(client, token):
    return client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()


def test_document_tables_exist(db):
    result = db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'"))
    assert result.fetchone() is not None, "Tabla 'documents' no existe"
    result = db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='document_chunks'"))
    assert result.fetchone() is not None, "Tabla 'document_chunks' no existe"


def test_upload_document_creates_record_and_chunks(client, db, tmp_path, monkeypatch):
    import app.services.biblioteca_service as bs
    monkeypatch.setattr(bs, "DATA_DIR", str(tmp_path))

    token = _login(client, "spec_upload@test.com")

    mock_page = MagicMock()
    mock_page.extract_text.return_value = "Texto sobre autismo y regulación emocional en niños. " * 20

    with patch("pdfplumber.open") as mock_pdfplumber:
        mock_pdfplumber.return_value.__enter__ = MagicMock(
            return_value=MagicMock(pages=[mock_page])
        )
        mock_pdfplumber.return_value.__exit__ = MagicMock(return_value=False)

        files = {"file": ("guia.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")}
        response = client.post(
            "/api/v1/biblioteca/upload",
            files=files,
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 201
    data = response.json()
    assert data["original_name"] == "guia.pdf"
    assert data["status"] == "ready"
    assert data["chunk_count"] >= 1


def test_upload_document_non_pdf_returns_422(client):
    token = _login(client, "spec_nonpdf@test.com")
    files = {"file": ("imagen.jpg", io.BytesIO(b"fake jpg"), "image/jpeg")}
    response = client.post(
        "/api/v1/biblioteca/upload",
        files=files,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def test_upload_document_too_large_returns_413(client, tmp_path, monkeypatch):
    import app.services.biblioteca_service as bs
    monkeypatch.setattr(bs, "DATA_DIR", str(tmp_path))

    token = _login(client, "spec_toolarge@test.com")
    large_bytes = b"X" * (10 * 1024 * 1024 + 1)
    files = {"file": ("big.pdf", io.BytesIO(large_bytes), "application/pdf")}
    response = client.post(
        "/api/v1/biblioteca/upload",
        files=files,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 413


def test_upload_document_parent_role_returns_403(client):
    token = _login(client, "parent_noupload@test.com", role="parent")
    files = {"file": ("doc.pdf", io.BytesIO(b"%PDF fake"), "application/pdf")}
    response = client.post(
        "/api/v1/biblioteca/upload",
        files=files,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


def test_list_documents_returns_all_documents(client, db):
    spec_token = _login(client, "spec_list@test.com")
    parent_token = _login(client, "parent_list@test.com", role="parent")
    spec_id = _me(client, spec_token)["id"]

    from datetime import datetime, timezone
    from app.models.document import Document
    for name in ["doc1.pdf", "doc2.pdf"]:
        db.add(Document(
            specialist_id=spec_id,
            filename=name,
            original_name=name,
            file_size_bytes=100,
            status="ready",
            chunk_count=3,
            created_at=datetime.now(timezone.utc),
        ))
    db.commit()

    for token in [spec_token, parent_token]:
        response = client.get(
            "/api/v1/biblioteca/documents",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert len(response.json()) == 2


def test_delete_document_removes_record_and_file(client, db, tmp_path, monkeypatch):
    import app.services.biblioteca_service as bs
    monkeypatch.setattr(bs, "DATA_DIR", str(tmp_path))

    token = _login(client, "spec_del@test.com")
    spec_id = _me(client, token)["id"]

    filename = "to_delete.pdf"
    file_path = tmp_path / filename
    file_path.write_bytes(b"fake pdf content")

    from datetime import datetime, timezone
    from app.models.document import Document
    doc = Document(
        specialist_id=spec_id,
        filename=filename,
        original_name="to_delete.pdf",
        file_size_bytes=16,
        status="ready",
        chunk_count=0,
        created_at=datetime.now(timezone.utc),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    response = client.delete(
        f"/api/v1/biblioteca/documents/{doc.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 204
    assert not file_path.exists()
    assert db.query(Document).filter(Document.id == doc.id).first() is None


def test_delete_document_other_specialist_returns_404(client, db, tmp_path, monkeypatch):
    import app.services.biblioteca_service as bs
    monkeypatch.setattr(bs, "DATA_DIR", str(tmp_path))

    owner_token = _login(client, "spec_owner@test.com")
    other_token = _login(client, "spec_other@test.com")
    owner_id = _me(client, owner_token)["id"]

    from datetime import datetime, timezone
    from app.models.document import Document
    doc = Document(
        specialist_id=owner_id,
        filename="owner_doc.pdf",
        original_name="owner_doc.pdf",
        file_size_bytes=100,
        status="ready",
        chunk_count=0,
        created_at=datetime.now(timezone.utc),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    response = client.delete(
        f"/api/v1/biblioteca/documents/{doc.id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert response.status_code == 404


def test_ask_no_documents_returns_default_message(client):
    token = _login(client, "parent_ask_empty@test.com", role="parent")
    response = client.post(
        "/api/v1/biblioteca/ask",
        json={"question": "¿Qué es el autismo?"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "especialista" in data["answer"].lower()
    assert data["sources"] == []


def test_ask_with_documents_calls_claude(client, db, tmp_path, monkeypatch):
    import app.services.biblioteca_service as bs
    monkeypatch.setattr(bs, "DATA_DIR", str(tmp_path))

    spec_token = _login(client, "spec_ask@test.com")
    parent_token = _login(client, "parent_ask@test.com", role="parent")
    spec_id = _me(client, spec_token)["id"]

    from datetime import datetime, timezone
    from app.models.document import Document
    from app.models.document_chunk import DocumentChunk

    doc = Document(
        specialist_id=spec_id,
        filename="test.pdf",
        original_name="guia_autismo.pdf",
        file_size_bytes=100,
        status="ready",
        chunk_count=1,
        created_at=datetime.now(timezone.utc),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    db.add(DocumentChunk(
        document_id=doc.id,
        chunk_index=0,
        content="Las rutinas predecibles son fundamentales para niños con autismo.",
        embedding="[]",
        created_at=datetime.now(timezone.utc),
    ))
    db.commit()

    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="Las rutinas ayudan a reducir la ansiedad.")]

    with patch("app.services.biblioteca_service.anthropic_client") as mock_claude:
        mock_claude.messages.create.return_value = mock_response
        response = client.post(
            "/api/v1/biblioteca/ask",
            json={"question": "rutinas autismo"},
            headers={"Authorization": f"Bearer {parent_token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "Las rutinas ayudan a reducir la ansiedad."
    assert len(data["sources"]) == 1
    assert data["sources"][0]["doc_name"] == "guia_autismo.pdf"
    assert len(data["sources"][0]["fragment"]) <= 150


def test_ask_empty_question_returns_422(client):
    token = _login(client, "parent_ask_empty2@test.com", role="parent")
    response = client.post(
        "/api/v1/biblioteca/ask",
        json={"question": ""},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def test_ask_unauthenticated_returns_401(client):
    response = client.post(
        "/api/v1/biblioteca/ask",
        json={"question": "¿Qué es el autismo?"},
    )
    assert response.status_code == 401
