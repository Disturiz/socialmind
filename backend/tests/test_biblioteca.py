import pytest
from unittest.mock import MagicMock, patch
import io
from sqlalchemy import text


def _login(client, email, role="specialist"):
    client.post("/api/v1/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Test User", "role": role,
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

    mock_embedding_data = MagicMock()
    mock_embedding_data.embedding = [0.1] * 1536

    with patch("pdfplumber.open") as mock_pdfplumber, \
         patch("app.services.biblioteca_service.openai_client") as mock_openai:
        mock_pdfplumber.return_value.__enter__ = MagicMock(
            return_value=MagicMock(pages=[mock_page])
        )
        mock_pdfplumber.return_value.__exit__ = MagicMock(return_value=False)
        mock_openai.embeddings.create.return_value = MagicMock(
            data=[mock_embedding_data]
        )

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
