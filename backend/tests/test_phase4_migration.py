from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, KnowledgeUnit, KnowledgeVersion, Scenario, ScenarioVersion
from app.services.phase4_migration import migrate_phase4, payload_hash
from app.services.scenario.publication import publish_phase4_templates
from tests.test_scenario_publication import template_payload


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def seed_knowledge(database: Session) -> None:
    version = KnowledgeVersion(
        id="knowledge-1",
        version_hash="k" * 64,
        label="正式知识库",
        status="published",
        is_active=True,
    )
    version.units.append(
        KnowledgeUnit(
            id="unit-1",
            unit_key="returns",
            title="退货",
            content="退货规则",
            category_path=["售后"],
            content_hash="u" * 64,
            sources=[{"source_path": "faq.md", "anchor": "h:退货"}],
        )
    )
    database.add(version)
    database.commit()


def test_migration_is_deterministic_and_idempotent() -> None:
    payload = template_payload()
    first_database = make_session()
    second_database = make_session()
    seed_knowledge(first_database)
    seed_knowledge(second_database)

    first = migrate_phase4(first_database, [payload])
    first_database.commit()
    second = migrate_phase4(second_database, [payload])
    second_database.commit()
    repeat = migrate_phase4(first_database, [payload])

    assert first["source_hash"] == payload_hash([payload])
    assert first["target_hash"] == second["target_hash"]
    assert first["created_versions"] == 1
    assert repeat["created_versions"] == 0
    assert first_database.query(Scenario).count() == 1
    assert first_database.query(ScenarioVersion).count() == 1


def test_migration_reports_relationship_counts() -> None:
    database = make_session()
    seed_knowledge(database)

    report = migrate_phase4(database, [template_payload()])

    assert report["scenarios"] == 1
    assert report["scenario_versions"] == 1
    assert report["source_locators_checked"] == 1
