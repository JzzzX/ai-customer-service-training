from dataclasses import dataclass

from sqlalchemy import Select, and_, func, select
from sqlalchemy.orm import Session

from app.models import KnowledgeVersion, Question, QuizSet


@dataclass(frozen=True)
class TopicCatalog:
    id: str
    label: str
    question_count: int
    description: str
    knowledge_version: str


class PublishedCatalogRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_topics(self) -> list[TopicCatalog]:
        statement: Select[tuple[str, str, str, str, int]] = (
            select(
                QuizSet.id,
                QuizSet.label,
                QuizSet.description,
                KnowledgeVersion.id.label("knowledge_version"),
                func.count(Question.id).label("question_count"),
            )
            .join(KnowledgeVersion, QuizSet.knowledge_version_id == KnowledgeVersion.id)
            .outerjoin(
                Question,
                and_(
                    Question.quiz_set_id == QuizSet.id,
                    Question.status == "published",
                ),
            )
            .where(
                QuizSet.status == "published",
                KnowledgeVersion.status == "published",
                KnowledgeVersion.is_active.is_(True),
            )
            .group_by(
                QuizSet.id,
                QuizSet.label,
                QuizSet.description,
                KnowledgeVersion.id,
            )
            .order_by(QuizSet.label, QuizSet.id)
        )
        return [
            TopicCatalog(
                id=row.id,
                label=row.label,
                question_count=row.question_count,
                description=row.description,
                knowledge_version=row.knowledge_version,
            )
            for row in self.session.execute(statement)
        ]
