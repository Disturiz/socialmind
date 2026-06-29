import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.scenarios import ScenarioMeta, ScenarioFull, ScenarioCompletionOut
from app.services.scenario_service import list_scenarios, get_scenario, complete_scenario
from app.gamification.service import register_event

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=list[ScenarioMeta])
def get_scenarios(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_scenarios(db, current_user.id)


@router.get("/{scenario_id}", response_model=ScenarioFull)
def get_scenario_by_id(scenario_id: int):
    return get_scenario(scenario_id)


@router.post("/{scenario_id}/complete", response_model=ScenarioCompletionOut, status_code=201)
def complete_scenario_endpoint(
    scenario_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = complete_scenario(db, current_user.id, scenario_id)
    try:
        register_event(db, current_user.id, "scenario_completed", {"scenario_id": scenario_id})
    except Exception:
        logger.exception("gamification register_event failed")
    return result
