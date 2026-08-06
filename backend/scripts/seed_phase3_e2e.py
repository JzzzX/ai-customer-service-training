import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select, update

from app.core.database import get_database
from app.models import (
    EvaluationReport,
    KnowledgeUnit,
    KnowledgeVersion,
    Question,
    QuizSet,
    ScenarioVersion,
    TrainingSession,
    User,
)
from app.services.phase4_migration import migrate_phase4
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
        admin = session.get(User, "e2e-admin")
        if not admin:
            admin = User(
                id="e2e-admin",
                email="e2e-admin@example.test",
                name="端到端管理员",
                role="admin",
                is_active=True,
            )
            session.add(admin)

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

        phase4_payload_path = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "phase4-export.json"
        phase4_payloads = json.loads(phase4_payload_path.read_text(encoding="utf-8"))
        for index, locator in enumerate(
            sorted(
                {
                    (item["source_path"], item["anchor"]): item
                    for payload in phase4_payloads
                    for item in payload["source_locators"]
                }.values(),
                key=lambda item: (item["source_path"], item["anchor"]),
            )
        ):
            unit_key = f"e2e-scenario-unit-{index}"
            unit = session.scalar(
                select(KnowledgeUnit).where(
                    KnowledgeUnit.knowledge_version_id == version.id,
                    KnowledgeUnit.unit_key == unit_key,
                )
            )
            if not unit:
                unit = KnowledgeUnit(
                    id=unit_key,
                    knowledge_version_id=version.id,
                    unit_key=unit_key,
                    title=f"E2E 场景知识 {index + 1}",
                    content="用于 Phase 4 场景来源门禁和 Provider E2E 验收。",
                    category_path=["E2E", "实战"],
                    content_hash=canonical_quiz_hash(("e2e-scenario", index)),
                    sources=[locator],
                    can_use_for_quiz=False,
                    can_use_for_scenario=True,
                    can_use_for_evaluation=True,
                )
                session.add(unit)

        session.flush()
        migrate_phase4(session, phase4_payloads)

        review_version = session.scalar(
            select(ScenarioVersion).where(ScenarioVersion.status == "published")
        )
        review_session = session.get(TrainingSession, "e2e-review-session")
        if review_version and not review_session:
            review_session = TrainingSession(
                id="e2e-review-session",
                learner_id=learner.id,
                knowledge_version_id=version.id,
                scenario_version_id=review_version.id,
                status="completed",
                mode="mock",
                turn_count=1,
                max_turns=review_version.max_turns,
            )
            review_session.report = EvaluationReport(
                id="e2e-review-report",
                knowledge_version_id=version.id,
                total_score=62,
                verdict="needs_retry",
                dimensions=[{"key": "policy", "score": 62}],
                strengths=[],
                omissions=["确认订单"],
                risks=[],
                recommendations=["补充确认"],
                confidence=0.62,
                low_confidence=True,
                needs_review=True,
                review_trigger="e2e_seed",
            )
            session.add(review_session)

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
