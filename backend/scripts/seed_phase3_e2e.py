import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select, update

from app.core.database import get_database
from app.models import KnowledgeUnit, KnowledgeVersion, Question, QuizSet, User
from app.services.quiz.publication import canonical_quiz_hash


def main() -> int:
    settings = __import__("config.settings", fromlist=["get_settings"]).get_settings()
    if settings.app_env != "test":
        raise SystemExit("phase 3 E2E seed requires APP_ENV=test")
    with get_database().session_scope() as session:
        learner = session.get(User, "e2e-learner")
        if not learner:
            learner = User(
                id="e2e-learner",
                email="e2e@example.test",
                name="端到端学员",
                role="learner",
                is_active=True,
            )
            session.add(learner)

        session.execute(
            update(KnowledgeVersion)
            .where(KnowledgeVersion.is_active.is_(True))
            .values(is_active=False)
        )
        version = session.scalar(
            select(KnowledgeVersion).where(
                KnowledgeVersion.version_hash == "e" * 64
            )
        )
        if not version:
            version = KnowledgeVersion(
                id="e2e-knowledge-v1",
                version_hash="e" * 64,
                label="E2E 正式知识库",
                schema_version=1,
                source_root="test://phase3-e2e",
                coverage={"topic_count": 1, "question_count": 10},
                status="published",
                is_active=True,
            )
            session.add(version)
        else:
            version.status = "published"
            version.is_active = True

        units = []
        for index in range(10):
            unit_key = f"e2e-unit-{index}"
            unit = session.scalar(
                select(KnowledgeUnit).where(
                    KnowledgeUnit.knowledge_version_id == version.id,
                    KnowledgeUnit.unit_key == unit_key,
                )
            )
            if not unit:
                unit = KnowledgeUnit(
                    id=f"e2e-unit-{index}",
                    knowledge_version_id=version.id,
                    unit_key=unit_key,
                    title=f"E2E 知识 {index + 1}",
                    content=f"E2E 题目 {index + 1} 的知识依据。",
                    category_path=["E2E", "退换货"],
                    content_hash=canonical_quiz_hash(("e2e", index)),
                    sources=[
                        {
                            "source_path": "e2e-fixture.md",
                            "kind": "markdown",
                            "anchor": f"h:e2e-{index}",
                            "path": ["E2E", "退换货"],
                        }
                    ],
                    can_use_for_quiz=True,
                )
                session.add(unit)
            units.append(unit)

        quiz_set = session.scalar(
            select(QuizSet).where(QuizSet.quiz_hash == "f" * 64)
        )
        if not quiz_set:
            quiz_set = QuizSet(
                id="e2e-quiz-returns",
                knowledge_version_id=version.id,
                topic_key="e2e-returns",
                label="E2E 退换货专题",
                quiz_hash="f" * 64,
                description="用于公司技术栈端到端验收。",
                passing_score=80,
                status="published",
            )
            for index, unit in enumerate(units):
                answer = f"正确 {index + 1}"
                quiz_set.questions.append(
                    Question(
                        id=f"e2e-question-{index}",
                        question_key=f"e2e-question-{index}",
                        knowledge_unit=unit,
                        prompt=f"E2E 题目 {index + 1}：正确选项是哪一个？",
                        question_type="single_choice",
                        options=[answer, f"错误 {index + 1}"],
                        correct_answers=[answer],
                        explanation="E2E 服务端判分反馈。",
                        category="e2e-returns",
                        difficulty=(
                            "easy"
                            if index < 5
                            else "medium"
                            if index < 8
                            else "hard"
                        ),
                        position=index + 1,
                        status="published",
                    )
                )
            session.add(quiz_set)
    print("phase3 e2e fixture ready")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
