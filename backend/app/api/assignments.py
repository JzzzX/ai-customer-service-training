from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_session
from app.models import Assignment, User
from app.schemas.overview import AssignmentPageResponse, AssignmentResponse


router = APIRouter(prefix="/me", tags=["assignments"])


@router.get("/assignments", response_model=AssignmentPageResponse)
def list_my_assignments(
    status: str | None = Query(default=None, max_length=32),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AssignmentPageResponse:
    statement = select(Assignment).where(Assignment.learner_id == user.id)
    count_statement = select(func.count()).select_from(Assignment).where(Assignment.learner_id == user.id)
    if status:
        statement = statement.where(Assignment.status == status)
        count_statement = count_statement.where(Assignment.status == status)
    total = int(session.scalar(count_statement) or 0)
    items = list(
        session.scalars(
            statement.order_by(Assignment.created_at.desc(), Assignment.id.desc())
            .offset(offset)
            .limit(limit)
        )
    )
    next_offset = offset + limit if offset + limit < total else None
    return AssignmentPageResponse(
        items=[AssignmentResponse.model_validate(item) for item in items],
        total=total,
        next_offset=next_offset,
    )
