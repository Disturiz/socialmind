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
