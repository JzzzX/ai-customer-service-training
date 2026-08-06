import random

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import (
    Base,
    KnowledgeProgress,
    KnowledgeVersion,
    Question,
    QuizAnswer,
    QuizSet,
    User,
)
from app.services.quiz.attempts import QuizAttemptError, QuizAttemptService


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def seed_catalog(database: Session, *, question_count: int = 3) -> None:
    database.add_all(
        [
            User(
                id="learner-1",
                email="one@example.test",
                name="学员一",
                role="learner",
                is_active=True,
            ),
            User(
                id="learner-2",
                email="two@example.test",
                name="学员二",
                role="learner",
                is_active=True,
            ),
        ]
    )
    version = KnowledgeVersion(
        id="knowledge-v1",
        version_hash="a" * 64,
        label="正式知识库",
        status="published",
        is_active=True,
    )
    quiz_set = QuizSet(
        id="set-returns",
        topic_key="returns",
        quiz_hash="b" * 64,
        knowledge_version=version,
        label="退换货",
        description="售后专题",
        passing_score=80,
        status="published",
    )
    difficulties = ["easy"] * 5 + ["medium"] * 5 + ["hard"] * 2
    for index in range(question_count):
        answer = f"A{index}"
        quiz_set.questions.append(
            Question(
                id=f"question-{index}",
                question_key=f"legacy-{index}",
                prompt=f"题目 {index}",
                question_type="single_choice",
                options=[answer, f"B{index}"],
                correct_answers=[answer],
                explanation=f"解析 {index}",
                category="returns",
                difficulty=difficulties[index],
                position=index + 1,
                status="published",
            )
        )
    quiz_set.questions.append(
        Question(
            id="draft-question",
            question_key="draft-question",
            prompt="草稿题",
            question_type="true_false",
            options=["正确", "错误"],
            correct_answers=["正确"],
            category="returns",
            difficulty="easy",
            position=99,
            status="draft",
        )
    )
    database.add(quiz_set)
    database.commit()


def test_start_uses_difficulty_quotas_and_hides_answers() -> None:
    database = make_session()
    seed_catalog(database, question_count=12)
    service = QuizAttemptService(database, rng=random.Random(7))

    attempt = service.start_attempt("learner-1", "returns")
    database.commit()

    assert len(attempt.questions) == 10
    assert {question.difficulty for question in attempt.questions} == {
        "easy",
        "medium",
        "hard",
    }
    assert sum(question.difficulty == "easy" for question in attempt.questions) == 4
    assert sum(question.difficulty == "medium" for question in attempt.questions) == 4
    assert sum(question.difficulty == "hard" for question in attempt.questions) == 2
    assert not hasattr(attempt.questions[0], "correct_answers")
    assert "draft-question" not in [question.id for question in attempt.questions]


def test_submit_scores_on_server_is_idempotent_and_updates_progress() -> None:
    database = make_session()
    seed_catalog(database)
    service = QuizAttemptService(database, rng=random.Random(1))
    attempt = service.start_attempt("learner-1", "returns")
    answers = [
        {
            "question_id": question.id,
            "selected_answers": [f"A{question.id.rsplit('-', 1)[-1]}"],
        }
        for question in attempt.questions
    ]
    wrong_index = answers[-1]["question_id"].rsplit("-", 1)[-1]
    answers[-1]["selected_answers"] = [f"B{wrong_index}"]

    result = service.submit_attempt("learner-1", attempt.attempt_id, answers)
    database.commit()
    repeated = service.submit_attempt("learner-1", attempt.attempt_id, answers)

    assert result.score == 67
    assert result.status == "needs_retry"
    assert [item.is_correct for item in result.answers] == [True, True, False]
    assert result.answers[0].correct_answers[0].startswith("A")
    assert repeated == result
    assert database.query(QuizAnswer).count() == 3
    progress = database.get(KnowledgeProgress, "learner-1")
    assert progress.unique_answered_count == 3
    assert progress.total_correct_answers == 2
    assert progress.accuracy == 67


def test_submit_rejects_missing_or_foreign_questions_without_partial_answers() -> None:
    database = make_session()
    seed_catalog(database)
    service = QuizAttemptService(database, rng=random.Random(1))
    attempt = service.start_attempt("learner-1", "returns")

    with pytest.raises(QuizAttemptError) as caught:
        service.submit_attempt(
            "learner-1",
                attempt.attempt_id,
            [{"question_id": attempt.questions[0].id, "selected_answers": ["A0"]}],
        )

    assert caught.value.code == "QUIZ_ATTEMPT_INVALID"
    assert database.query(QuizAnswer).count() == 0


def test_attempt_rejects_cross_user_access() -> None:
    database = make_session()
    seed_catalog(database)
    service = QuizAttemptService(database, rng=random.Random(1))
    attempt = service.start_attempt("learner-1", "returns")

    with pytest.raises(QuizAttemptError) as caught:
        service.submit_attempt("learner-2", attempt.attempt_id, [])

    assert caught.value.code == "QUIZ_ATTEMPT_FORBIDDEN"
