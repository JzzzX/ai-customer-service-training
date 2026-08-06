from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import AppError
from app.models import (
    AdminAuditEvent,
    Assignment,
    EvaluationReport,
    Question,
    QuestionReview,
    QuizSet,
    ReviewDecision,
    ScenarioVersion,
    TrainingSession,
    User,
)
from app.repositories.admin import AdminRepository
from app.schemas.admin import (
    AssignmentCreateRequest,
    QuestionReviewUpdateRequest,
    ReviewDecisionRequest,
)


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

    def create_assignment(self, payload: AssignmentCreateRequest, *, admin_id: str) -> Assignment:
        learner = self.session.get(User, payload.learner_id)
        if learner is None or learner.role != "learner" or not learner.is_active:
            raise AppError(code="LEARNER_NOT_FOUND", message="学员不存在或不可分配任务。", status_code=404)
        if payload.assignment_type == "quiz":
            target = self.session.get(QuizSet, payload.target_id)
            target_label = target.label if target else None
        else:
            target = self.session.get(ScenarioVersion, payload.target_id)
            target_label = target.scenario.title if target else None
        if target is None or getattr(target, "status", "published") != "published":
            raise AppError(code="ASSIGNMENT_TARGET_NOT_FOUND", message="任务目标不存在或尚未发布。", status_code=404)
        assignment = Assignment(
            id=f"assignment_{uuid4().hex}",
            learner_id=payload.learner_id,
            assigned_by_id=admin_id,
            assignment_type=payload.assignment_type,
            target_id=payload.target_id,
            target_label=target_label or payload.target_id,
            due_at=payload.due_at,
        )
        self.session.add(assignment)
        self.session.add(
            AdminAuditEvent(
                actor_id=admin_id,
                action="assignment_create",
                resource_type="assignment",
                resource_id=assignment.id,
                details={"learner_id": payload.learner_id, "target_id": payload.target_id},
            )
        )
        self.session.flush()
        return assignment

    def review_question(
        self,
        question_id: str,
        *,
        reviewer_id: str,
        payload: QuestionReviewUpdateRequest,
    ) -> Question:
        question = self.session.get(Question, question_id)
        if question is None:
            raise AppError(code="QUESTION_NOT_FOUND", message="题目不存在。", status_code=404)
        for field in ("prompt", "options", "correct_answers", "explanation", "category", "difficulty"):
            value = getattr(payload, field)
            if value is not None:
                setattr(question, field, value)
        if question.correct_answers and any(answer not in question.options for answer in question.correct_answers):
            raise AppError(code="QUESTION_INVALID", message="正确答案必须属于题目选项。", status_code=422)
        question.status = "published" if payload.status == "approved" else "draft"
        snapshot = {
            "prompt": question.prompt,
            "options": question.options,
            "correct_answers": question.correct_answers,
            "explanation": question.explanation,
            "category": question.category,
            "difficulty": question.difficulty,
            "status": question.status,
            "comment": payload.comment,
        }
        content_hash = hashlib.sha256(
            json.dumps(snapshot, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        self.session.add(
            QuestionReview(
                id=f"question_review_{uuid4().hex}",
                question_id=question.id,
                reviewer_id=reviewer_id,
                content_hash=content_hash,
                snapshot=snapshot,
            )
        )
        self.session.add(
            AdminAuditEvent(
                actor_id=reviewer_id,
                action="question_review",
                resource_type="question",
                resource_id=question.id,
                details={"status": question.status, "content_hash": content_hash},
            )
        )
        self.session.flush()
        return question

    def publish_quiz_set(self, quiz_set_id: str, *, admin_id: str) -> QuizSet:
        quiz_set = self.session.scalar(
            select(QuizSet)
            .options(selectinload(QuizSet.questions))
            .where(QuizSet.id == quiz_set_id)
        )
        if quiz_set is None:
            raise AppError(code="QUIZ_SET_NOT_FOUND", message="题组不存在。", status_code=404)
        if quiz_set.knowledge_version.status != "published" or not quiz_set.knowledge_version.is_active:
            raise AppError(code="KNOWLEDGE_VERSION_NOT_ACTIVE", message="题组引用的知识版本未激活。", status_code=409)
        quiz_set.status = "published"
        quiz_set.published_at = datetime.now(UTC)
        for question in quiz_set.questions:
            question.status = "published"
        self.session.add(
            AdminAuditEvent(
                actor_id=admin_id,
                action="quiz_set_publish",
                resource_type="quiz_set",
                resource_id=quiz_set.id,
                details={"question_count": len(quiz_set.questions)},
            )
        )
        self.session.flush()
        return quiz_set

    def review_detail(self, report_id: str) -> dict[str, object]:
        report = self.session.scalar(
            select(EvaluationReport)
            .options(
                selectinload(EvaluationReport.training_session).selectinload(TrainingSession.messages),
                selectinload(EvaluationReport.review_records),
            )
            .where(EvaluationReport.id == report_id)
        )
        if report is None:
            raise AppError(code="REVIEW_NOT_FOUND", message="未找到复核报告。", status_code=404)
        return {
            "report": {
                "id": report.id,
                "training_session_id": report.training_session_id,
                "total_score": report.total_score,
                "verdict": report.verdict,
                "dimensions": report.dimensions,
                "strengths": report.strengths,
                "omissions": report.omissions,
                "risks": report.risks,
                "recommendations": report.recommendations,
                "evidence": report.evidence,
                "review_trigger": report.review_trigger,
            },
            "messages": [
                {"id": message.id, "position": message.position, "sender": message.sender, "content": message.content}
                for message in report.training_session.messages
            ],
            "decisions": [
                {
                    "id": item.id,
                    "status": item.status,
                    "corrected_score": item.corrected_score,
                    "corrected_verdict": item.corrected_verdict,
                    "comment": item.comment,
                    "created_at": item.created_at,
                }
                for item in report.review_records
            ],
        }

    def question_detail(self, question_id: str) -> dict[str, object]:
        question = self.session.scalar(
            select(Question)
            .options(selectinload(Question.reviews))
            .where(Question.id == question_id)
        )
        if question is None:
            raise AppError(code="QUESTION_NOT_FOUND", message="题目不存在。", status_code=404)
        latest = max(question.reviews, key=lambda item: item.created_at, default=None)
        return {
            "id": question.id,
            "quiz_set_id": question.quiz_set_id,
            "prompt": question.prompt,
            "options": question.options,
            "correct_answers": question.correct_answers,
            "explanation": question.explanation,
            "category": question.category,
            "difficulty": question.difficulty,
            "status": question.status,
            "latest_review": latest.snapshot if latest else None,
        }
