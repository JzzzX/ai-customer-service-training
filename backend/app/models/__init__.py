from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


from app.models.user import FeishuIdentity, User
from app.models.learning import Assignment, KnowledgeProgress, ScenarioProgressSummary
from app.models.catalog import (
    KnowledgeSource,
    KnowledgeUnit,
    KnowledgeVersion,
    Question,
    QuestionReview,
    QuizAnswer,
    QuizAttempt,
    QuizSet,
    quiz_set_questions,
)
from app.models.scenario import (
    EvaluationReport,
    ReviewDecision,
    Scenario,
    ScenarioVersion,
    TrainingMessage,
    TrainingSession,
)
from app.models.admin import AdminAuditEvent

__all__ = [
    "Assignment",
    "AdminAuditEvent",
    "Base",
    "FeishuIdentity",
    "KnowledgeProgress",
    "KnowledgeSource",
    "KnowledgeUnit",
    "KnowledgeVersion",
    "Question",
    "QuestionReview",
    "EvaluationReport",
    "ReviewDecision",
    "QuizAnswer",
    "QuizAttempt",
    "QuizSet",
    "quiz_set_questions",
    "ScenarioProgressSummary",
    "Scenario",
    "ScenarioVersion",
    "TrainingMessage",
    "TrainingSession",
    "User",
]
