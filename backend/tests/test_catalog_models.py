from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import (
    Base,
    KnowledgeVersion,
    Question,
    QuestionReview,
    QuizSet,
    User,
)


def test_catalog_models_persist_published_quiz_content() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as database:
        knowledge_version = KnowledgeVersion(
            id="knowledge-2026-08",
            label="2026 年 8 月正式知识库",
            status="published",
            is_active=True,
        )
        quiz_set = QuizSet(
            id="pet-nutrition",
            knowledge_version=knowledge_version,
            label="宠物营养",
            description="宠物食品与营养知识专题",
            status="published",
        )
        quiz_set.questions.append(
            Question(
                id="question-1",
                prompt="幼猫应优先选择哪类主粮？",
                question_type="single_choice",
                options=["幼猫粮", "成猫粮"],
                correct_answers=["幼猫粮"],
                status="published",
            )
        )
        database.add(quiz_set)
        database.commit()

        saved = database.get(QuizSet, "pet-nutrition")

        assert saved is not None
        assert saved.knowledge_version.id == "knowledge-2026-08"
        assert saved.questions[0].options == ["幼猫粮", "成猫粮"]
        assert saved.questions[0].correct_answers == ["幼猫粮"]


def test_quiz_set_keeps_many_to_many_order_and_question_review_snapshot() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as database:
        user = User(
            id="admin-1",
            email="admin@example.test",
            name="管理员",
            role="admin",
            is_active=True,
        )
        version = KnowledgeVersion(
            id="knowledge-1",
            label="知识库",
            status="published",
            is_active=True,
        )
        first = Question(
            id="question-1",
            question_key="q1",
            prompt="第一题",
            question_type="single_choice",
            options=["A", "B"],
            correct_answers=["A"],
            status="published",
            position=1,
        )
        second = Question(
            id="question-2",
            question_key="q2",
            prompt="第二题",
            question_type="single_choice",
            options=["A", "B"],
            correct_answers=["B"],
            status="published",
            position=2,
        )
        quiz_set = QuizSet(
            id="set-1",
            knowledge_version=version,
            label="专题",
            status="published",
            questions=[second, first],
        )
        first.reviews.append(
            QuestionReview(
                id="review-1",
                reviewer_id="admin-1",
                content_hash="h" * 64,
                snapshot={"prompt": "第一题", "status": "approved"},
            )
        )
        database.add_all([user, quiz_set])
        database.commit()

        saved = database.get(QuizSet, "set-1")
        assert saved is not None
        assert [question.id for question in saved.questions] == ["question-1", "question-2"]
        assert saved.questions[0].reviews[0].snapshot["status"] == "approved"
