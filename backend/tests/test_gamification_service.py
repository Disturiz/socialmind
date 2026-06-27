import pytest
from datetime import date, timedelta
from app.core.security import hash_password as get_password_hash
from app.models.user import User, UserRole
from app.models.user_rewards import UserRewards
from app.gamification.service import register_event, get_progress
from app.gamification.config import STARS_PER_EVENT


def _make_user(db, email="gami@test.com"):
    u = User(
        email=email,
        hashed_password=get_password_hash("Test123!"),
        full_name="Test",
        role=UserRole.parent,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def test_register_event_awards_correct_stars(db):
    user = _make_user(db, "stars@test.com")
    register_event(db, user.id, "lumi_chat")
    rewards = db.query(UserRewards).filter(UserRewards.user_id == user.id).first()
    expected = STARS_PER_EVENT["lumi_chat"] + STARS_PER_EVENT["daily_streak"]
    assert rewards.total_stars == expected


def test_daily_streak_fires_once_per_day(db):
    user = _make_user(db, "once@test.com")
    register_event(db, user.id, "lumi_chat")
    register_event(db, user.id, "lumi_chat")
    rewards = db.query(UserRewards).filter(UserRewards.user_id == user.id).first()
    expected = STARS_PER_EVENT["lumi_chat"] * 2 + STARS_PER_EVENT["daily_streak"]
    assert rewards.total_stars == expected
    assert rewards.current_streak == 1


def test_streak_increments_for_consecutive_days(db):
    user = _make_user(db, "consec@test.com")
    register_event(db, user.id, "calm_session")
    rewards = db.query(UserRewards).filter(UserRewards.user_id == user.id).first()
    rewards.last_activity_date = date.today() - timedelta(days=1)
    db.commit()
    register_event(db, user.id, "calm_session")
    db.refresh(rewards)
    assert rewards.current_streak == 2


def test_streak_resets_after_gap(db):
    user = _make_user(db, "gap@test.com")
    register_event(db, user.id, "calm_session")
    rewards = db.query(UserRewards).filter(UserRewards.user_id == user.id).first()
    rewards.last_activity_date = date.today() - timedelta(days=3)
    rewards.current_streak = 5
    db.commit()
    register_event(db, user.id, "calm_session")
    db.refresh(rewards)
    assert rewards.current_streak == 1


def test_level_up_when_crossing_threshold(db):
    user = _make_user(db, "level@test.com")
    rewards = UserRewards(
        user_id=user.id, total_stars=46, current_streak=0,
        current_level_key="explorador", badges=[], last_activity_date=None,
    )
    db.add(rewards)
    db.commit()
    result = register_event(db, user.id, "lumi_chat")  # +3 chat + 15 streak = 18 → total 64 ≥ 50
    db.refresh(rewards)
    assert rewards.current_level_key == "aventurero"
    assert result["level_up"] is True


def test_badge_primer_paso_awarded_on_first_scenario(db):
    user = _make_user(db, "badge1@test.com")
    result = register_event(db, user.id, "scenario_completed", {"scenario_id": 1})
    assert "primer_paso" in result["new_badges"]


def test_badge_not_duplicated_on_repeat(db):
    user = _make_user(db, "badge2@test.com")
    register_event(db, user.id, "scenario_completed", {"scenario_id": 1})
    result2 = register_event(db, user.id, "scenario_completed", {"scenario_id": 2})
    assert "primer_paso" not in result2["new_badges"]


def test_maestro_social_requires_all_five_unique_scenarios(db):
    user = _make_user(db, "maestro@test.com")
    for sid in [1, 2, 3, 4]:
        register_event(db, user.id, "scenario_completed", {"scenario_id": sid})
    rewards = db.query(UserRewards).filter(UserRewards.user_id == user.id).first()
    assert "maestro_social" not in rewards.badges
    result = register_event(db, user.id, "scenario_completed", {"scenario_id": 5})
    assert "maestro_social" in result["new_badges"]


def test_get_progress_returns_defaults_for_new_user(db):
    user = _make_user(db, "fresh@test.com")
    progress = get_progress(db, user.id)
    assert progress["total_stars"] == 0
    assert progress["current_streak"] == 0
    assert progress["level"]["key"] == "explorador"
    assert progress["progress_pct"] == 0
    assert len(progress["badges"]) == 13
    assert not any(b["earned"] for b in progress["badges"])


def test_get_progress_shows_earned_badges(db):
    user = _make_user(db, "earned@test.com")
    register_event(db, user.id, "scenario_completed", {"scenario_id": 1})
    progress = get_progress(db, user.id)
    earned = [b for b in progress["badges"] if b["earned"]]
    assert any(b["key"] == "primer_paso" for b in earned)
