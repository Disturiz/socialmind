from pydantic import BaseModel


class LevelOut(BaseModel):
    key: str
    name: str


class NextLevelOut(BaseModel):
    key: str
    name: str
    min_stars: int


class BadgeOut(BaseModel):
    key: str
    name: str
    earned: bool


class ProgressOut(BaseModel):
    total_stars: int
    current_streak: int
    level: LevelOut
    next_level: NextLevelOut | None
    progress_pct: int
    badges: list[BadgeOut]
