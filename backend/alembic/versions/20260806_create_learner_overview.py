"""create learner overview read models

Revision ID: 20260806overview
Revises: 924faa8bdcab
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260806overview"
down_revision: str | None = "924faa8bdcab"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "assignments",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("learner_id", sa.String(length=36), nullable=False),
        sa.Column("assigned_by_id", sa.String(length=36), nullable=False),
        sa.Column("assignment_type", sa.String(length=32), nullable=False),
        sa.Column("target_id", sa.String(length=36), nullable=False),
        sa.Column("target_label", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["learner_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_assignments_learner_id", "assignments", ["learner_id"], unique=False
    )
    op.create_table(
        "knowledge_progress",
        sa.Column("learner_id", sa.String(length=36), nullable=False),
        sa.Column("total_questions", sa.Integer(), nullable=False),
        sa.Column("unique_answered_count", sa.Integer(), nullable=False),
        sa.Column("total_correct_answers", sa.Integer(), nullable=False),
        sa.Column("total_answered_answers", sa.Integer(), nullable=False),
        sa.Column("accuracy", sa.Integer(), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["learner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("learner_id"),
    )
    op.create_table(
        "scenario_progress_summaries",
        sa.Column("learner_id", sa.String(length=36), nullable=False),
        sa.Column("published_scenario_count", sa.Integer(), nullable=False),
        sa.Column("completed_scenario_count", sa.Integer(), nullable=False),
        sa.Column("completed_session_count", sa.Integer(), nullable=False),
        sa.Column("recent_average_score", sa.Integer(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["learner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("learner_id"),
    )


def downgrade() -> None:
    op.drop_table("scenario_progress_summaries")
    op.drop_table("knowledge_progress")
    op.drop_index("ix_assignments_learner_id", table_name="assignments")
    op.drop_table("assignments")
