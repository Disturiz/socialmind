from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class ScenarioOption(BaseModel):
    text: str
    correct: bool


class ScenarioStep(BaseModel):
    type: str   # "objective" | "explanation" | "practice" | "feedback" | "closing"
    lumi_state: str  # "idle" | "thinking" | "happy" | "encouraging"
    title: Optional[str] = None
    text: Optional[str] = None
    question: Optional[str] = None
    options: Optional[list[ScenarioOption]] = None
    badge_emoji: Optional[str] = None


class ScenarioMeta(BaseModel):
    id: int
    emoji: str
    title: str
    description: str


class ScenarioFull(ScenarioMeta):
    steps: list[ScenarioStep]


class ScenarioCompletionOut(BaseModel):
    id: int
    scenario_id: int
    completed_at: datetime

    model_config = {"from_attributes": True}
