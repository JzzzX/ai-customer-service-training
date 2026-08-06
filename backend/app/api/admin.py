from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import admin_required, get_session
from app.models import User
from app.schemas.admin import (
    AdminOverviewResponse,
    AdminPageResponse,
    AdminQuestionDetailResponse,
    AdminReviewDetailResponse,
    AssignmentCreateRequest,
    QuestionReviewUpdateRequest,
    PublishQuizSetResponse,
    ScenarioDraftGenerateRequest,
    ScenarioDraftGenerateResponse,
    ReviewDecisionRequest,
    ReviewDecisionResponse,
)
from app.services.admin import AdminService
from app.services.scenario.drafts import generate_scenario_drafts


router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/overview", response_model=AdminOverviewResponse)
def get_admin_overview(
    _admin: User = Depends(admin_required),
    session: Session = Depends(get_session),
) -> AdminOverviewResponse:
    return AdminOverviewResponse(counts=AdminService(session).overview())


@router.get("/{resource}", response_model=AdminPageResponse)
def list_admin_resource(
    resource: str,
    status: str | None = Query(default=None, max_length=32),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    _admin: User = Depends(admin_required),
    session: Session = Depends(get_session),
) -> AdminPageResponse:
    if resource not in {"knowledge", "questions", "scenarios", "assignments", "reviews", "history"}:
        from app.core.errors import AppError

        raise AppError(code="NOT_FOUND", message="管理资源不存在。", status_code=404)
    page = AdminService(session).list_resource(
        resource, status=status, offset=offset, limit=limit
    )
    return AdminPageResponse(
        items=page.items, total=page.total, next_offset=page.next_offset
    )


@router.post(
    "/reviews/{report_id}/decision",
    response_model=ReviewDecisionResponse,
    status_code=201,
)
def decide_admin_review(
    report_id: str,
    payload: ReviewDecisionRequest,
    admin: User = Depends(admin_required),
    session: Session = Depends(get_session),
) -> ReviewDecisionResponse:
    decision = AdminService(session).decide_review(
        report_id, reviewer_id=admin.id, payload=payload
    )
    return ReviewDecisionResponse.model_validate(decision, from_attributes=True)


@router.get("/reviews/{report_id}", response_model=AdminReviewDetailResponse)
def get_admin_review_detail(
    report_id: str,
    _admin: User = Depends(admin_required),
    session: Session = Depends(get_session),
) -> AdminReviewDetailResponse:
    return AdminReviewDetailResponse.model_validate(
        AdminService(session).review_detail(report_id)
    )


@router.get("/questions/{question_id}", response_model=AdminQuestionDetailResponse)
def get_admin_question_detail(
    question_id: str,
    _admin: User = Depends(admin_required),
    session: Session = Depends(get_session),
) -> AdminQuestionDetailResponse:
    return AdminQuestionDetailResponse.model_validate(
        AdminService(session).question_detail(question_id)
    )


@router.post("/assignments", response_model=dict, status_code=201)
def create_admin_assignment(
    payload: AssignmentCreateRequest,
    admin: User = Depends(admin_required),
    session: Session = Depends(get_session),
) -> dict:
    assignment = AdminService(session).create_assignment(payload, admin_id=admin.id)
    return {
        "assignment": {
            "id": assignment.id,
            "learner_id": assignment.learner_id,
            "assignment_type": assignment.assignment_type,
            "target_id": assignment.target_id,
            "target_label": assignment.target_label,
            "status": assignment.status,
        }
    }


@router.patch("/questions/{question_id}/review", response_model=dict)
def review_admin_question(
    question_id: str,
    payload: QuestionReviewUpdateRequest,
    admin: User = Depends(admin_required),
    session: Session = Depends(get_session),
) -> dict:
    question = AdminService(session).review_question(
        question_id, reviewer_id=admin.id, payload=payload
    )
    return {"id": question.id, "status": question.status}


@router.post("/quiz-sets/{quiz_set_id}/publish", response_model=PublishQuizSetResponse)
def publish_admin_quiz_set(
    quiz_set_id: str,
    admin: User = Depends(admin_required),
    session: Session = Depends(get_session),
) -> PublishQuizSetResponse:
    quiz_set = AdminService(session).publish_quiz_set(quiz_set_id, admin_id=admin.id)
    return PublishQuizSetResponse(
        id=quiz_set.id, status=quiz_set.status, question_count=len(quiz_set.questions)
    )


@router.post(
    "/scenario-drafts/generate",
    response_model=ScenarioDraftGenerateResponse,
)
def generate_admin_scenario_drafts(
    payload: ScenarioDraftGenerateRequest,
    _admin: User = Depends(admin_required),
) -> ScenarioDraftGenerateResponse:
    return ScenarioDraftGenerateResponse(
        scenarios=generate_scenario_drafts(payload.category, payload.count)
    )
