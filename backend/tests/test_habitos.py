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
