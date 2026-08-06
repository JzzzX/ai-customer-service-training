from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


from app.models.user import FeishuIdentity, User
from app.models.learning import Assignment, KnowledgeProgress, ScenarioProgressSummary

__all__ = [
    "Assignment",
    "Base",
    "FeishuIdentity",
    "KnowledgeProgress",
    "ScenarioProgressSummary",
    "User",
]
