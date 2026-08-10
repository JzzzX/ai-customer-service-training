from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, KnowledgeVersion, Question, QuizSet


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
