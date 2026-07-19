from sqlalchemy import text


def test_habit_infographics_table_exists(db):
    result = db.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name='habit_infographics'")
    )
    assert result.fetchone() is not None, "Tabla 'habit_infographics' no existe"
