from __future__ import annotations

from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import AdminAuditEvent, EvaluationReport, ReviewDecision
from app.repositories.admin import AdminRepository
from app.schemas.admin import ReviewDecisionRequest


class AdminService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def overview(self) -> dict[str, int]:
        return AdminRepository(self.session).overview()

    def list_resource(self, resource: str, *, status: str | None, offset: int, limit: int):
        return AdminRepository(self.session).list_resource(
            resource, status=status, offset=offset, limit=limit
        )

    def decide_review(
        self,
        report_id: str,
        *,
        reviewer_id: str,
        payload: ReviewDecisionRequest,
    ) -> ReviewDecision:
        report = self.session.get(EvaluationReport, report_id)
        if report is None:
            raise AppError(
                code="REVIEW_NOT_FOUND",
                message="未找到待复核报告。",
                status_code=404,
            )
        decision = ReviewDecision(
            id=f"review_{uuid4().hex}",
            report_id=report.id,
            reviewer_id=reviewer_id,
            status=payload.status,
            corrected_verdict=payload.corrected_verdict,
            corrected_score=payload.corrected_score,
            comment=payload.comment,
        )
        report.needs_review = False
        self.session.add(decision)
        self.session.flush()
        self.session.add(
            AdminAuditEvent(
                actor_id=reviewer_id,
                action="review_decision",
                resource_type="evaluation_report",
                resource_id=report.id,
                details={
                    "decision_id": decision.id,
                    "status": decision.status,
                    "corrected_score": decision.corrected_score,
                    "corrected_verdict": decision.corrected_verdict,
                },
            )
        )
        return decision
