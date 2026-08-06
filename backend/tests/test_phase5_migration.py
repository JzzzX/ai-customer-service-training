from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import AdminAuditEvent, Base, KnowledgeUnit, KnowledgeVersion, User
from app.services.phase5_migration import MigrationError, migrate_database, snapshot_database
from scripts.rehearse_phase5 import run_rehearsal


def create_database(path: Path):
    engine = create_engine(f"sqlite+pysqlite:///{path}")
    Base.metadata.create_all(engine)
    return engine


def seed_database(engine) -> None:
    with Session(engine) as database:
        created_at = datetime(2026, 8, 6, 1, 2, 3, tzinfo=UTC)
        database.add(
            User(
                id="user-1",
                email="user@example.test",
                name="迁移用户",
                role="admin",
                is_active=True,
                created_at=created_at,
                updated_at=created_at,
            )
        )
        database.add(
            KnowledgeVersion(
                id="knowledge-1",
                version_hash="k" * 64,
                label="迁移知识",
                source_root="fixture://phase5",
                coverage={"question_count": 1},
                status="published",
                is_active=True,
                created_at=created_at,
                updated_at=created_at,
            )
        )
        database.flush()
        database.add(
            KnowledgeUnit(
                id="unit-1",
                knowledge_version_id="knowledge-1",
                unit_key="returns",
                title="退货规则",
                content="确认订单。",
                category_path=["售后"],
                content_hash="u" * 64,
                sources=[{"path": "returns.md"}],
                created_at=created_at,
            )
        )
        database.add(
            AdminAuditEvent(
                id="audit-1",
                actor_id="user-1",
                action="seed",
                resource_type="fixture",
                resource_id="phase5",
                details={"source": "test"},
                created_at=created_at,
            )
        )
        database.commit()


def test_snapshot_hash_is_deterministic_and_reports_orphans(tmp_path: Path) -> None:
    engine = create_database(tmp_path / "source.db")
    seed_database(engine)

    first = snapshot_database(Session(engine))
    second = snapshot_database(Session(engine))

    assert first["hash"] == second["hash"]
    assert first["row_counts"]["users"] == 1
    assert first["row_counts"]["knowledge_units"] == 1
    assert first["foreign_key_orphans"] == []


def test_snapshot_reports_foreign_key_orphan_rows(tmp_path: Path) -> None:
    engine = create_database(tmp_path / "orphan.db")
    with engine.begin() as connection:
        connection.execute(
            KnowledgeUnit.__table__.insert().values(
                id="orphan-unit",
                knowledge_version_id="missing-knowledge",
                unit_key="orphan",
                title="孤立内容",
                content="不应进入正式迁移。",
                category_path=[],
                content_hash="o" * 64,
                sources=[],
            )
        )

    snapshot = snapshot_database(Session(engine))

    assert snapshot["foreign_key_orphans"] == [
        {
            "table": "knowledge_units",
            "column": "knowledge_version_id",
            "referenced_table": "knowledge_versions",
            "referenced_column": "id",
            "count": 1,
        }
    ]


def test_migration_preserves_rows_json_timestamps_and_hash(tmp_path: Path) -> None:
    source = create_database(tmp_path / "source.db")
    target = create_database(tmp_path / "target.db")
    seed_database(source)

    result = migrate_database(
        f"sqlite+pysqlite:///{tmp_path / 'source.db'}",
        f"sqlite+pysqlite:///{tmp_path / 'target.db'}",
    )

    assert result["match"] is True
    assert result["source"]["hash"] == result["target"]["hash"]
    with Session(target) as database:
        copied = database.get(KnowledgeUnit, "unit-1")
        assert copied.sources == [{"path": "returns.md"}]
        assert copied.created_at == datetime(2026, 8, 6, 1, 2, 3)


def test_dirty_target_is_refused_and_dry_run_does_not_write(tmp_path: Path) -> None:
    source = create_database(tmp_path / "source.db")
    target = create_database(tmp_path / "target.db")
    seed_database(source)
    with Session(target) as database:
        database.add(
            User(
                id="existing",
                email="existing@example.test",
                name="已有数据",
                role="learner",
                is_active=True,
            )
        )
        database.commit()

    with pytest.raises(MigrationError, match="target database is not empty"):
        migrate_database(
            f"sqlite+pysqlite:///{tmp_path / 'source.db'}",
            f"sqlite+pysqlite:///{tmp_path / 'target.db'}",
        )

    target_empty = create_database(tmp_path / "target-empty.db")
    result = migrate_database(
        f"sqlite+pysqlite:///{tmp_path / 'source.db'}",
        f"sqlite+pysqlite:///{tmp_path / 'target-empty.db'}",
        dry_run=True,
    )
    assert result["dry_run"] is True
    with Session(target_empty) as database:
        assert database.query(User).count() == 0


def test_two_isolated_rehearsals_produce_identical_report(tmp_path: Path) -> None:
    first = run_rehearsal(tmp_path / "first")
    second = run_rehearsal(tmp_path / "second")

    assert first == second
    assert first["match"] is True
    assert first["runs"] == 2
