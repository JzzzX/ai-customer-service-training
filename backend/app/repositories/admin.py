from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    AdminAuditEvent,
    Assignment,
    EvaluationReport,
    KnowledgeUnit,
    KnowledgeVersion,
    Question,
    QuizSet,
    Scenario,
    ScenarioVersion,
    TrainingSession,
    User,
)


ResourceName = Literal[
    "knowledge", "questions", "scenarios", "assignments", "reviews", "history"
]


@dataclass(frozen=True)
class AdminPage:
    items: list[dict[str, Any]]
    total: int
    next_offset: int | None


def _page(items: list[dict[str, Any]], total: int, offset: int, limit: int) -> AdminPage:
    page_size = max(1, min(limit, 100))
    page = items[offset : offset + page_size]
    next_offset = offset + page_size if offset + page_size < total else None
    return AdminPage(items=page, total=total, next_offset=next_offset)


class AdminRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def overview(self) -> dict[str, int]:
        return {
            "knowledge_versions": self._count(KnowledgeVersion),
            "knowledge_units": self._count(KnowledgeUnit),
            "questions": self._count(Question),
            "scenarios": self._count(Scenario),
            "assignments": self._count(Assignment),
            "training_sessions": self._count(TrainingSession),
            "reports": self._count(EvaluationReport),
            "audit_events": self._count(AdminAuditEvent),
        }

    def list_resource(
        self,
        resource: ResourceName,
        *,
        status: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> AdminPage:
        if resource == "knowledge":
            return self._knowledge(status, offset, limit)
        if resource == "questions":
            return self._questions(status, offset, limit)
        if resource == "scenarios":
            return self._scenarios(status, offset, limit)
        if resource == "assignments":
            return self._assignments(status, offset, limit)
        if resource == "reviews":
            return self._reviews(status, offset, limit)
        return self._history(status, offset, limit)

    def _knowledge(self, status: str | None, offset: int, limit: int) -> AdminPage:
        statement: Select[tuple[KnowledgeVersion]] = select(KnowledgeVersion).order_by(
            KnowledgeVersion.updated_at.desc(), KnowledgeVersion.id.desc()
        )
        if status:
            statement = statement.where(KnowledgeVersion.status == status)
        rows = list(self.session.scalars(statement).all())
        items = [
            {
                "id": row.id,
                "label": row.label,
                "status": row.status,
                "is_active": row.is_active,
                "version_hash": row.version_hash,
                "coverage": row.coverage or {},
                "updated_at": row.updated_at,
            }
            for row in rows
        ]
        return _page(items, len(items), offset, limit)

    def _questions(self, status: str | None, offset: int, limit: int) -> AdminPage:
        statement = (
            select(Question, QuizSet.label, KnowledgeUnit.title)
            .join(QuizSet, QuizSet.id == Question.quiz_set_id)
            .outerjoin(KnowledgeUnit, KnowledgeUnit.id == Question.knowledge_unit_id)
            .order_by(Question.updated_at.desc(), Question.id.desc())
        )
        if status:
            statement = statement.where(Question.status == status)
        rows = list(self.session.execute(statement))
        items = [
            {
                "id": question.id,
                "question_key": question.question_key,
                "prompt": question.prompt,
                "question_type": question.question_type,
                "difficulty": question.difficulty,
                "status": question.status,
                "quiz_label": quiz_label,
                "knowledge_title": knowledge_title,
                "updated_at": question.updated_at,
            }
            for question, quiz_label, knowledge_title in rows
        ]
        return _page(items, len(items), offset, limit)

    def _scenarios(self, status: str | None, offset: int, limit: int) -> AdminPage:
        statement = (
            select(Scenario, ScenarioVersion)
            .join(ScenarioVersion, ScenarioVersion.scenario_id == Scenario.id)
            .order_by(Scenario.updated_at.desc(), Scenario.id.desc(), ScenarioVersion.version.desc())
        )
        if status:
            statement = statement.where(Scenario.status == status)
        rows = list(self.session.execute(statement))
        latest: dict[str, tuple[Scenario, ScenarioVersion]] = {}
        for scenario, version in rows:
            latest.setdefault(scenario.id, (scenario, version))
        items = [
            {
                "id": scenario.id,
                "scenario_key": scenario.scenario_key,
                "title": scenario.title,
                "category": scenario.category,
                "status": scenario.status,
                "version_id": version.id,
                "version": version.version,
                "version_status": version.status,
                "updated_at": scenario.updated_at,
            }
            for scenario, version in latest.values()
        ]
        return _page(items, len(items), offset, limit)

    def _assignments(self, status: str | None, offset: int, limit: int) -> AdminPage:
        statement = (
            select(Assignment, User.name)
            .join(User, User.id == Assignment.learner_id)
            .order_by(Assignment.created_at.desc(), Assignment.id.desc())
        )
        if status:
            statement = statement.where(Assignment.status == status)
        rows = list(self.session.execute(statement))
        items = [
            {
                "id": assignment.id,
                "learner_id": assignment.learner_id,
                "learner_name": learner_name,
                "assignment_type": assignment.assignment_type,
                "target_id": assignment.target_id,
                "target_label": assignment.target_label,
                "status": assignment.status,
                "due_at": assignment.due_at,
                "created_at": assignment.created_at,
            }
            for assignment, learner_name in rows
        ]
        return _page(items, len(items), offset, limit)

    def _reviews(self, status: str | None, offset: int, limit: int) -> AdminPage:
        statement = (
            select(EvaluationReport)
            .options(
                selectinload(EvaluationReport.review_records),
                selectinload(EvaluationReport.training_session).selectinload(
                    TrainingSession.learner
                ),
            )
            .order_by(EvaluationReport.updated_at.desc(), EvaluationReport.id.desc())
        )
        reports = list(self.session.scalars(statement).all())
        items: list[dict[str, Any]] = []
        for report in reports:
            latest = max(report.review_records, key=lambda item: item.created_at, default=None)
            review_status = latest.status if latest else ("pending" if report.needs_review else "not_required")
            if status and review_status != status:
                continue
            items.append(
                {
                    "report_id": report.id,
                    "session_id": report.training_session_id,
                    "learner_id": report.training_session.learner_id,
                    "learner_name": report.training_session.learner.name,
                    "score": report.total_score,
                    "verdict": report.verdict,
                    "status": review_status,
                    "needs_review": report.needs_review,
                    "review_trigger": report.review_trigger,
                    "latest_comment": latest.comment if latest else "",
                    "updated_at": report.updated_at,
                }
            )
        return _page(items, len(items), offset, limit)

    def _history(self, status: str | None, offset: int, limit: int) -> AdminPage:
        statement = (
            select(AdminAuditEvent, User.name)
            .join(User, User.id == AdminAuditEvent.actor_id)
            .order_by(AdminAuditEvent.created_at.desc(), AdminAuditEvent.id.desc())
        )
        if status:
            statement = statement.where(AdminAuditEvent.action == status)
        rows = list(self.session.execute(statement))
        items = [
            {
                "id": event.id,
                "actor_id": event.actor_id,
                "actor_name": actor_name,
                "action": event.action,
                "resource_type": event.resource_type,
                "resource_id": event.resource_id,
                "details": event.details or {},
                "created_at": event.created_at,
            }
            for event, actor_name in rows
        ]
        return _page(items, len(items), offset, limit)

    def _count(self, model: Any) -> int:
        return int(self.session.scalar(select(func.count()).select_from(model)) or 0)
