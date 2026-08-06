from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import admin_required, get_session
from app.models import User
from app.schemas.admin import (
    AdminOverviewResponse,
    AdminPageResponse,
    ReviewDecisionRequest,
    ReviewDecisionResponse,
)
from app.services.admin import AdminService


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
