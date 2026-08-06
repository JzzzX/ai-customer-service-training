"""retain legacy provenance needed for a lossless PostgreSQL conversion

Revision ID: 20260806phase6provenance
Revises: 20260806phase6catalog
Create Date: 2026-08-06

"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260806phase6provenance"
down_revision: str | None = "20260806phase6catalog"
branch_labels: Sequence[str] | None = None
depends_on: str | None = None


def _add(table: str, columns: list[sa.Column]) -> None:
    with op.batch_alter_table(table) as batch_op:
        for column in columns:
            batch_op.add_column(column)


def upgrade() -> None:
    _add(
        "knowledge_versions",
        [
            sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_by_id", sa.String(length=36), nullable=True),
        ],
    )
    _add(
        "quiz_sets",
        [
            sa.Column("source_quiz_hash", sa.String(length=64), nullable=True),
            sa.Column("created_by_id", sa.String(length=36), nullable=True),
        ],
    )
    _add(
        "questions",
        [
            sa.Column("knowledge_version_id", sa.String(length=64), nullable=True),
            sa.Column("created_by_id", sa.String(length=36), nullable=True),
        ],
    )
    _add(
        "quiz_attempts",
        [
            sa.Column("assignment_id", sa.String(length=64), nullable=True),
            sa.Column("origin", sa.String(length=32), nullable=False, server_default="quiz"),
        ],
    )
    _add(
        "quiz_answers",
        [sa.Column("source_question_key", sa.String(length=128), nullable=True)],
    )
    _add(
        "scenarios",
        [sa.Column("created_by_id", sa.String(length=36), nullable=True)],
    )
    _add(
        "scenario_versions",
        [sa.Column("created_by_id", sa.String(length=36), nullable=True)],
    )

    op.create_index(
        "ix_knowledge_versions_created_by_id",
        "knowledge_versions",
        ["created_by_id"],
        unique=False,
    )
    op.create_index(
        "ix_quiz_sets_created_by_id", "quiz_sets", ["created_by_id"], unique=False
    )
    op.create_index(
        "ix_questions_knowledge_version_id",
        "questions",
        ["knowledge_version_id"],
        unique=False,
    )
    op.create_index(
        "ix_questions_created_by_id", "questions", ["created_by_id"], unique=False
    )
    op.create_index(
        "ix_quiz_attempts_assignment_id",
        "quiz_attempts",
        ["assignment_id"],
        unique=False,
    )
    op.create_index(
        "ix_scenarios_created_by_id", "scenarios", ["created_by_id"], unique=False
    )
    op.create_index(
        "ix_scenario_versions_created_by_id",
        "scenario_versions",
        ["created_by_id"],
        unique=False,
    )

    for table, column, referred in (
        ("knowledge_versions", "created_by_id", "users"),
        ("quiz_sets", "created_by_id", "users"),
        ("questions", "knowledge_version_id", "knowledge_versions"),
        ("questions", "created_by_id", "users"),
        ("scenarios", "created_by_id", "users"),
        ("scenario_versions", "created_by_id", "users"),
    ):
        with op.batch_alter_table(table) as batch_op:
            batch_op.create_foreign_key(
                f"fk_{table}_{column}", referred, [column], ["id"], ondelete="SET NULL"
            )


def downgrade() -> None:
    for table, constraint in (
        ("scenario_versions", "fk_scenario_versions_created_by_id"),
        ("scenarios", "fk_scenarios_created_by_id"),
        ("questions", "fk_questions_created_by_id"),
        ("questions", "fk_questions_knowledge_version_id"),
        ("quiz_sets", "fk_quiz_sets_created_by_id"),
        ("knowledge_versions", "fk_knowledge_versions_created_by_id"),
    ):
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_constraint(constraint, type_="foreignkey")

    for name, table in (
        ("ix_scenario_versions_created_by_id", "scenario_versions"),
        ("ix_scenarios_created_by_id", "scenarios"),
        ("ix_quiz_attempts_assignment_id", "quiz_attempts"),
        ("ix_questions_created_by_id", "questions"),
        ("ix_questions_knowledge_version_id", "questions"),
        ("ix_quiz_sets_created_by_id", "quiz_sets"),
        ("ix_knowledge_versions_created_by_id", "knowledge_versions"),
    ):
        op.drop_index(name, table_name=table)

    for table, columns in (
        ("scenario_versions", ("created_by_id",)),
        ("scenarios", ("created_by_id",)),
        ("quiz_answers", ("source_question_key",)),
        ("quiz_attempts", ("origin", "assignment_id")),
        ("questions", ("created_by_id", "knowledge_version_id")),
        ("quiz_sets", ("created_by_id", "source_quiz_hash")),
        ("knowledge_versions", ("created_by_id", "published_at")),
    ):
        with op.batch_alter_table(table) as batch_op:
            for column in columns:
                batch_op.drop_column(column)
