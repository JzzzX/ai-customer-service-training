from dataclasses import asdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_session
from app.models import User
from app.repositories.overview import LearnerOverviewRepository
from app.schemas.auth import CurrentUserResponse
from app.schemas.overview import (
    AssignmentResponse,
    KnowledgeProgressResponse,
    LearnerOverviewResponse,
    ScenarioProgressResponse,
)

router = APIRouter(prefix="/me", tags=["learner overview"])


@router.get("/overview", response_model=LearnerOverviewResponse)
def get_overview(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> LearnerOverviewResponse:
    overview = LearnerOverviewRepository(session).get_overview(user.id)
    return LearnerOverviewResponse(
        user=CurrentUserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
        ),
        assignments=[
            AssignmentResponse.model_validate(item) for item in overview.assignments
        ],
        knowledge=KnowledgeProgressResponse(**asdict(overview.knowledge)),
        scenario=ScenarioProgressResponse(**asdict(overview.scenario)),
    )
