from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, KnowledgeVersion, Scenario, ScenarioVersion, TrainingMessage, TrainingSession, User
from app.repositories.scenario import ScenarioRepository


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def seed(database: Session) -> None:
    database.add_all(
        [
            User(id="learner-1", email="one@example.test", name="一号", role="learner", is_active=True),
            User(id="learner-2", email="two@example.test", name="二号", role="learner", is_active=True),
            Scenario(id="scenario-1", scenario_key="returns", title="退货", category="presale", summary="退货", status="published"),
            Scenario(id="scenario-2", scenario_key="logistics", title="物流", category="logistics", summary="物流", status="draft"),
            KnowledgeVersion(
                id="knowledge-1",
                version_hash="k" * 64,
                label="知识版本",
                status="published",
                is_active=True,
            ),
        ]
    )
    database.flush()
    database.add_all(
        [
            ScenarioVersion(
                id="version-1",
                scenario_id="scenario-1",
                version_key="returns-v1",
                version=1,
                knowledge_version_id="knowledge-1",
                opening_message="你好",
                customer_turns=["退货"],
                scoring_dimensions=[],
                scoring_weights={},
                critical_risks=[],
                reference_flow=[],
                reference_reply="好的",
                sources=[],
                status="published",
            ),
            ScenarioVersion(
                id="version-2",
                scenario_id="scenario-2",
                version_key="logistics-v1",
                version=1,
                knowledge_version_id="knowledge-1",
                opening_message="你好",
                customer_turns=["物流"],
                scoring_dimensions=[],
                scoring_weights={},
                critical_risks=[],
                reference_flow=[],
                reference_reply="好的",
                sources=[],
                status="draft",
            ),
        ]
    )
    database.commit()


def test_repository_lists_only_published_scenarios() -> None:
    database = make_session()
    seed(database)

    versions = ScenarioRepository(database).list_published()

    assert [item.scenario.scenario_key for item in versions] == ["returns"]


def test_repository_enforces_owner_and_appends_ordered_exchange() -> None:
    database = make_session()
    seed(database)
    repository = ScenarioRepository(database)
    session = repository.create_session(
        learner_id="learner-1",
        version=repository.list_published()[0],
        mode="mock",
    )
    database.commit()

    assert repository.get_owned_session(session.id, "learner-2") is None
    saved = repository.append_messages(
        session,
        [
            ("customer", "你好", {"turn": 0}),
            ("learner", "我想退货", {"turn": 1}),
        ],
        turn_count=1,
    )
    database.commit()

    assert saved.turn_count == 1
    assert [(item.position, item.sender) for item in saved.messages] == [
        (0, "customer"),
        (1, "customer"),
        (2, "learner"),
    ]


def test_history_groups_sort_by_latest_activity_and_page_sessions() -> None:
    database = make_session()
    seed(database)
    repository = ScenarioRepository(database)
    version = repository.list_published()[0]
    older = repository.create_session(learner_id="learner-1", version=version, mode="mock")
    newer = repository.create_session(learner_id="learner-1", version=version, mode="mock")
    older.updated_at = datetime(2026, 8, 1, tzinfo=UTC)
    newer.updated_at = datetime(2026, 8, 2, tzinfo=UTC)
    older.messages.append(TrainingMessage(id="older-message", position=1, sender="customer", content="旧"))
    newer.messages.append(TrainingMessage(id="newer-message", position=1, sender="customer", content="新"))
    database.add_all([older, newer])
    database.commit()

    groups = repository.list_history_groups("learner-1", status="all", limit=20)
    sessions, cursor = repository.list_history_sessions("learner-1", "scenario-1", status="all", limit=1)

    assert groups[0]["scenario_id"] == "scenario-1"
    assert sessions[0].id == newer.id
    assert cursor is not None
