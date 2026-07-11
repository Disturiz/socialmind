from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.models.child_profile import ChildProfile
from app.models.specialist_assignment import SpecialistAssignment


def _get_child_for_parent(db: Session, child_id: int, parent_id: int) -> ChildProfile:
    child = db.query(ChildProfile).filter(
        ChildProfile.id == child_id,
        ChildProfile.parent_id == parent_id,
    ).first()
    if not child:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil de niño no encontrado.",
        )
    return child


def list_specialists(db: Session) -> list[User]:
    return (
        db.query(User)
        .filter(User.role == UserRole.specialist, User.is_active == True)
        .order_by(User.full_name)
        .all()
    )


def get_assigned_specialists(db: Session, child_id: int, parent_id: int) -> list[User]:
    _get_child_for_parent(db, child_id, parent_id)
    return (
        db.query(User)
        .join(SpecialistAssignment, SpecialistAssignment.specialist_id == User.id)
        .filter(SpecialistAssignment.child_profile_id == child_id)
        .order_by(User.full_name)
        .all()
    )


def assign_specialist(
    db: Session, child_id: int, specialist_id: int, parent_id: int
) -> SpecialistAssignment:
    _get_child_for_parent(db, child_id, parent_id)

    specialist = db.query(User).filter(
        User.id == specialist_id,
        User.role == UserRole.specialist,
        User.is_active == True,
    ).first()
    if not specialist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Especialista no encontrado.",
        )

    existing = db.query(SpecialistAssignment).filter(
        SpecialistAssignment.specialist_id == specialist_id,
        SpecialistAssignment.child_profile_id == child_id,
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este especialista ya está asignado a este niño.",
        )

    assignment = SpecialistAssignment(
        specialist_id=specialist_id,
        child_profile_id=child_id,
        assigned_at=datetime.now(timezone.utc),
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


def unassign_specialist(
    db: Session, child_id: int, specialist_id: int, parent_id: int
) -> None:
    _get_child_for_parent(db, child_id, parent_id)

    assignment = db.query(SpecialistAssignment).filter(
        SpecialistAssignment.specialist_id == specialist_id,
        SpecialistAssignment.child_profile_id == child_id,
    ).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asignación no encontrada.",
        )

    db.delete(assignment)
    db.commit()


def get_my_parents(db: Session, specialist_id: int) -> list[User]:
    return (
        db.query(User)
        .join(ChildProfile, ChildProfile.parent_id == User.id)
        .join(SpecialistAssignment, SpecialistAssignment.child_profile_id == ChildProfile.id)
        .filter(SpecialistAssignment.specialist_id == specialist_id)
        .distinct()
        .order_by(User.full_name)
        .all()
    )
