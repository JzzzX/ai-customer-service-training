from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


from app.models.user import FeishuIdentity, User
from app.models.learning import Assignment, KnowledgeProgress, ScenarioProgressSummary
from app.models.catalog import KnowledgeVersion, Question, QuizSet

__all__ = [
    "Assignment",
    "Base",
    "FeishuIdentity",
    "KnowledgeProgress",
    "KnowledgeVersion",
    "Question",
    "QuizSet",
    "ScenarioProgressSummary",
    "User",
]
