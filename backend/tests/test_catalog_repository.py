from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, KnowledgeVersion, Question, QuizSet
from app.repositories.catalog import PublishedCatalogRepository


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def add_quiz_set(
    database: Session,
    *,
    knowledge_id: str,
    knowledge_status: str = "published",
    knowledge_active: bool = True,
    quiz_id: str,
    quiz_label: str,
    quiz_status: str = "published",
    question_statuses: tuple[str, ...] = ("published",),
) -> None:
    knowledge_version = KnowledgeVersion(
        id=knowledge_id,
        label=knowledge_id,
        status=knowledge_status,
        is_active=knowledge_active,
    )
    quiz_set = QuizSet(
        id=quiz_id,
        knowledge_version=knowledge_version,
        label=quiz_label,
        description=f"{quiz_label}说明",
        status=quiz_status,
    )
    quiz_set.questions = [
        Question(
            id=f"{quiz_id}-question-{index}",
            prompt=f"题目 {index}",
            question_type="single_choice",
            options=["A", "B"],
            correct_answers=["A"],
            status=status,
        )
        for index, status in enumerate(question_statuses, start=1)
    ]
    database.add(quiz_set)


def test_list_topics_returns_only_published_catalog_from_active_knowledge() -> None:
    database = make_session()
    add_quiz_set(
        database,
        knowledge_id="knowledge-active",
        quiz_id="returns",
        quiz_label="退换货",
        question_statuses=("published", "published", "draft"),
    )
    add_quiz_set(
        database,
        knowledge_id="knowledge-active-draft-set",
        quiz_id="draft-set",
        quiz_label="草稿题库",
        quiz_status="draft",
    )
    add_quiz_set(
        database,
        knowledge_id="knowledge-inactive",
        knowledge_active=False,
        quiz_id="inactive-knowledge-set",
        quiz_label="旧知识版本题库",
    )
    add_quiz_set(
        database,
        knowledge_id="knowledge-draft",
        knowledge_status="draft",
        quiz_id="draft-knowledge-set",
        quiz_label="草稿知识题库",
    )
    database.commit()

    topics = PublishedCatalogRepository(database).list_topics()

    assert [topic.id for topic in topics] == ["returns"]
    assert topics[0].knowledge_version == "knowledge-active"
    assert topics[0].question_count == 2


def test_list_topics_orders_by_label_then_stable_id() -> None:
    database = make_session()
    knowledge_version = KnowledgeVersion(
        id="knowledge-active",
        label="正式知识库",
        status="published",
        is_active=True,
    )
    database.add_all(
        [
            QuizSet(
                id="topic-b",
                knowledge_version=knowledge_version,
                label="物流",
                description="B",
                status="published",
            ),
            QuizSet(
                id="topic-a",
                knowledge_version=knowledge_version,
                label="物流",
                description="A",
                status="published",
            ),
            QuizSet(
                id="topic-c",
                knowledge_version=knowledge_version,
                label="售后",
                description="C",
                status="published",
            ),
        ]
    )
    database.commit()

    topics = PublishedCatalogRepository(database).list_topics()

    assert [topic.id for topic in topics] == ["topic-c", "topic-a", "topic-b"]
