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
    QuizAnswer,
    QuizAttempt,
    QuizSet,
)

__all__ = [
    "Assignment",
    "Base",
    "FeishuIdentity",
    "KnowledgeProgress",
    "KnowledgeSource",
    "KnowledgeUnit",
    "KnowledgeVersion",
    "Question",
    "QuizAnswer",
    "QuizAttempt",
    "QuizSet",
    "ScenarioProgressSummary",
    "User",
]
