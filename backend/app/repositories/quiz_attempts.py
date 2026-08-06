from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    KnowledgeVersion,
    Question,
    QuizAttempt,
    QuizSet,
    quiz_set_questions,
)


class QuizAttemptRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def find_published_topic(self, topic_id: str) -> QuizSet | None:
        return self.session.scalar(
            select(QuizSet)
            .options(selectinload(QuizSet.knowledge_version))
            .join(KnowledgeVersion, QuizSet.knowledge_version_id == KnowledgeVersion.id)
            .where(
                or_(
                    QuizSet.topic_key == topic_id,
                    and_(QuizSet.topic_key.is_(None), QuizSet.id == topic_id),
                ),
                QuizSet.status == "published",
                KnowledgeVersion.status == "published",
                KnowledgeVersion.is_active.is_(True),
            )
        )

    def list_published_questions(self, quiz_set_id: str) -> list[Question]:
        return list(
            self.session.scalars(
                select(Question)
                .join(
                    quiz_set_questions,
                    quiz_set_questions.c.question_id == Question.id,
                )
                .where(
                    quiz_set_questions.c.quiz_set_id == quiz_set_id,
                    Question.status == "published",
                )
                .order_by(
                    quiz_set_questions.c.position,
                    Question.position,
                    Question.id,
                )
            )
        )

    def get_attempt(self, attempt_id: str) -> QuizAttempt | None:
        return self.session.scalar(
            select(QuizAttempt)
            .options(selectinload(QuizAttempt.quiz_set))
            .where(QuizAttempt.id == attempt_id)
        )
