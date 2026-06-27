from datetime import datetime, date, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.reward_event import RewardEvent
from app.models.user_rewards import UserRewards
from app.gamification.config import STARS_PER_EVENT, LEVELS, BADGES


def _compute_level(total_stars: int) -> str:
    current = LEVELS[0]["key"]
    for level in LEVELS:
        if total_stars >= level["min_stars"]:
            current = level["key"]
    return current


def _level_index(key: str) -> int:
    for i, level in enumerate(LEVELS):
        if level["key"] == key:
            return i
    return 0


def _count_events(db: Session, user_id: int, event_type: str) -> int:
    return db.query(func.count(RewardEvent.id)).filter(
        RewardEvent.user_id == user_id,
        RewardEvent.event_type == event_type,
    ).scalar() or 0


def _count_unique_scenarios(db: Session, user_id: int) -> int:
    events = db.query(RewardEvent).filter(
        RewardEvent.user_id == user_id,
        RewardEvent.event_type == "scenario_completed",
    ).all()
    return len({
        e.extra_data.get("scenario_id")
        for e in events
        if e.extra_data and "scenario_id" in e.extra_data
    })


def _evaluate_new_badges(db: Session, user_id: int, rewards: UserRewards) -> list[str]:
    current = set(rewards.badges or [])
    new_badges = []
    for badge in BADGES:
        key = badge["key"]
        if key in current:
            continue
        cond = badge["condition"]
        if "unique_scenarios" in cond:
            earned = _count_unique_scenarios(db, user_id) >= cond["unique_scenarios"]
        elif "event_type" in cond:
            earned = _count_events(db, user_id, cond["event_type"]) >= cond["count"]
        elif "streak" in cond:
            earned = (rewards.current_streak or 0) >= cond["streak"]
        elif "level" in cond:
            earned = _level_index(rewards.current_level_key) >= _level_index(cond["level"])
        else:
            earned = False
        if earned:
            new_badges.append(key)
    return new_badges


def register_event(
    db: Session,
    user_id: int,
    event_type: str,
    extra_data: dict | None = None,
) -> dict:
    today = date.today()

    rewards = db.query(UserRewards).filter(UserRewards.user_id == user_id).first()
    if not rewards:
        rewards = UserRewards(
            user_id=user_id, total_stars=0, current_streak=0,
            current_level_key="explorador", badges=[], last_activity_date=None,
        )
        db.add(rewards)
        db.flush()

    # Daily streak bonus — once per day
    if rewards.last_activity_date != today:
        yesterday = today - timedelta(days=1)
        if rewards.last_activity_date == yesterday:
            rewards.current_streak = (rewards.current_streak or 0) + 1
        else:
            rewards.current_streak = 1
        rewards.last_activity_date = today
        db.add(RewardEvent(
            user_id=user_id,
            event_type="daily_streak",
            stars_earned=STARS_PER_EVENT["daily_streak"],
        ))
        rewards.total_stars = (rewards.total_stars or 0) + STARS_PER_EVENT["daily_streak"]

    # Main event
    stars = STARS_PER_EVENT.get(event_type, 0)
    db.add(RewardEvent(
        user_id=user_id,
        event_type=event_type,
        stars_earned=stars,
        extra_data=extra_data,
    ))
    rewards.total_stars = (rewards.total_stars or 0) + stars

    # Level
    old_level = rewards.current_level_key or "explorador"
    rewards.current_level_key = _compute_level(rewards.total_stars)
    level_up = rewards.current_level_key != old_level

    db.flush()

    new_badge_keys = _evaluate_new_badges(db, user_id, rewards)
    if new_badge_keys:
        rewards.badges = list(rewards.badges or []) + new_badge_keys

    rewards.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {"new_badges": new_badge_keys, "level_up": level_up}


def get_progress(db: Session, user_id: int) -> dict:
    rewards = db.query(UserRewards).filter(UserRewards.user_id == user_id).first()

    if not rewards:
        return {
            "total_stars": 0,
            "current_streak": 0,
            "level": {"key": "explorador", "name": "Explorador"},
            "next_level": {"key": "aventurero", "name": "Aventurero", "min_stars": 50},
            "progress_pct": 0,
            "badges": [{"key": b["key"], "name": b["name"], "earned": False} for b in BADGES],
        }

    current_level = next((l for l in LEVELS if l["key"] == rewards.current_level_key), LEVELS[0])
    current_idx = _level_index(rewards.current_level_key)
    next_level = LEVELS[current_idx + 1] if current_idx + 1 < len(LEVELS) else None

    if next_level:
        stars_in = (rewards.total_stars or 0) - current_level["min_stars"]
        stars_needed = next_level["min_stars"] - current_level["min_stars"]
        progress_pct = min(100, int(stars_in / stars_needed * 100))
    else:
        progress_pct = 100

    earned_set = set(rewards.badges or [])
    return {
        "total_stars": rewards.total_stars or 0,
        "current_streak": rewards.current_streak or 0,
        "level": {"key": current_level["key"], "name": current_level["name"]},
        "next_level": {
            "key": next_level["key"],
            "name": next_level["name"],
            "min_stars": next_level["min_stars"],
        } if next_level else None,
        "progress_pct": progress_pct,
        "badges": [
            {"key": b["key"], "name": b["name"], "earned": b["key"] in earned_set}
            for b in BADGES
        ],
    }
