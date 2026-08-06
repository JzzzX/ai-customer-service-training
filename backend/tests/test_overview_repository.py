from datetime import UTC, datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Assignment, Base, KnowledgeProgress, ScenarioProgressSummary
from app.repositories.overview import LearnerOverviewRepository


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def test_overview_returns_only_the_requested_learners_data() -> None:
    database = make_session()
    database.add_all(
        [
            Assignment(
                id="assignment-1",
                learner_id="learner-1",
                assigned_by_id="admin-1",
                assignment_type="quiz",
                target_id="quiz-1",
                target_label="物流专题测验",
                status="assigned",
                created_at=datetime(2026, 8, 1, tzinfo=UTC),
            ),
            Assignment(
                id="assignment-2",
                learner_id="learner-2",
                assigned_by_id="admin-1",
                assignment_type="scenario",
                target_id="scenario-2",
                target_label="其他学员场景",
                status="assigned",
                created_at=datetime(2026, 8, 2, tzinfo=UTC),
            ),
            KnowledgeProgress(
                learner_id="learner-1",
                total_questions=40,
                unique_answered_count=12,
                total_correct_answers=10,
                total_answered_answers=12,
                accuracy=83,
                attempt_count=2,
            ),
            ScenarioProgressSummary(
                learner_id="learner-1",
                published_scenario_count=8,
                completed_scenario_count=3,
                completed_session_count=5,
                recent_average_score=86,
            ),
        ]
    )
    database.commit()

    overview = LearnerOverviewRepository(database).get_overview("learner-1")

    assert [item.target_label for item in overview.assignments] == ["物流专题测验"]
    assert overview.knowledge.unique_answered_count == 12
    assert overview.scenario.completed_session_count == 5


def test_overview_uses_zero_value_summaries_when_progress_is_missing() -> None:
    database = make_session()

    overview = LearnerOverviewRepository(database).get_overview("learner-1")

    assert overview.assignments == []
    assert overview.knowledge.total_questions == 0
    assert overview.scenario.completed_scenario_count == 0
