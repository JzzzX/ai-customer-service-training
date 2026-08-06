"""create phase 4 scenario training tables

Revision ID: 20260806phase4
Revises: 20260806quizpub
"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260806phase4"
down_revision: str | None = "20260806quizpub"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "scenarios",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("scenario_key", sa.String(length=128), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scenario_key", name="uq_scenarios_scenario_key"),
    )
    op.create_index("ix_scenarios_scenario_key", "scenarios", ["scenario_key"], unique=False)
    op.create_index("ix_scenarios_category", "scenarios", ["category"], unique=False)
    op.create_index("ix_scenarios_status", "scenarios", ["status"], unique=False)

    op.create_table(
        "scenario_versions",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("scenario_id", sa.String(length=64), nullable=False),
        sa.Column("version_key", sa.String(length=128), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("knowledge_version_id", sa.String(length=64), nullable=False),
        sa.Column("background", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("opening_message", sa.Text(), nullable=False),
        sa.Column("controlled_variables", sa.JSON(), nullable=False),
        sa.Column("hidden_facts", sa.JSON(), nullable=False),
        sa.Column("customer_turns", sa.JSON(), nullable=False),
        sa.Column("checkpoints", sa.JSON(), nullable=False),
        sa.Column("prohibitions", sa.JSON(), nullable=False),
        sa.Column("scoring_weights", sa.JSON(), nullable=False),
        sa.Column("scoring_dimensions", sa.JSON(), nullable=False),
        sa.Column("critical_risks", sa.JSON(), nullable=False),
        sa.Column("reference_flow", sa.JSON(), nullable=False),
        sa.Column("reference_reply", sa.Text(), nullable=False),
        sa.Column("sources", sa.JSON(), nullable=False),
        sa.Column("max_turns", sa.Integer(), nullable=False),
        sa.Column("mock_mode", sa.Boolean(), nullable=False),
        sa.Column("customer_persona", sa.JSON(), nullable=True),
        sa.Column("difficulty", sa.String(length=32), nullable=False),
        sa.Column("scenario_focus", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["scenario_id"], ["scenarios.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["knowledge_version_id"], ["knowledge_versions.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("version_key", name="uq_scenario_versions_version_key"),
        sa.UniqueConstraint("scenario_id", "version", name="uq_scenario_versions_number"),
        sa.UniqueConstraint("scenario_id", "version_key", name="uq_scenario_versions_key"),
    )
    op.create_index("ix_scenario_versions_scenario_id", "scenario_versions", ["scenario_id"], unique=False)
    op.create_index("ix_scenario_versions_version_key", "scenario_versions", ["version_key"], unique=False)
    op.create_index("ix_scenario_versions_knowledge_version_id", "scenario_versions", ["knowledge_version_id"], unique=False)
    op.create_index("ix_scenario_versions_status", "scenario_versions", ["status"], unique=False)

    op.create_table(
        "training_sessions",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("assignment_id", sa.String(length=64), nullable=True),
        sa.Column("learner_id", sa.String(length=36), nullable=False),
        sa.Column("knowledge_version_id", sa.String(length=64), nullable=False),
        sa.Column("scenario_version_id", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("mode", sa.String(length=16), nullable=False),
        sa.Column("turn_count", sa.Integer(), nullable=False),
        sa.Column("max_turns", sa.Integer(), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["learner_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["knowledge_version_id"], ["knowledge_versions.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["scenario_version_id"], ["scenario_versions.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_training_sessions_assignment_id", "training_sessions", ["assignment_id"], unique=False)
    op.create_index("ix_training_sessions_learner_id", "training_sessions", ["learner_id"], unique=False)
    op.create_index("ix_training_sessions_knowledge_version_id", "training_sessions", ["knowledge_version_id"], unique=False)
    op.create_index("ix_training_sessions_scenario_version_id", "training_sessions", ["scenario_version_id"], unique=False)
    op.create_index("ix_training_sessions_status", "training_sessions", ["status"], unique=False)

    op.create_table(
        "training_messages",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("training_session_id", sa.String(length=64), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("sender", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["training_session_id"], ["training_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("training_session_id", "position", name="uq_training_messages_position"),
    )
    op.create_index("ix_training_messages_training_session_id", "training_messages", ["training_session_id"], unique=False)

    op.create_table(
        "evaluation_reports",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("training_session_id", sa.String(length=64), nullable=False),
        sa.Column("knowledge_version_id", sa.String(length=64), nullable=False),
        sa.Column("total_score", sa.Integer(), nullable=False),
        sa.Column("verdict", sa.String(length=32), nullable=False),
        sa.Column("dimensions", sa.JSON(), nullable=False),
        sa.Column("strengths", sa.JSON(), nullable=False),
        sa.Column("omissions", sa.JSON(), nullable=False),
        sa.Column("risks", sa.JSON(), nullable=False),
        sa.Column("recommendations", sa.JSON(), nullable=False),
        sa.Column("turn_feedback", sa.JSON(), nullable=False),
        sa.Column("recommended_flow", sa.JSON(), nullable=False),
        sa.Column("sample_reply", sa.Text(), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("low_confidence", sa.Boolean(), nullable=False),
        sa.Column("needs_review", sa.Boolean(), nullable=False),
        sa.Column("review_trigger", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["training_session_id"], ["training_sessions.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["knowledge_version_id"], ["knowledge_versions.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("training_session_id"),
    )
    op.create_index("ix_evaluation_reports_training_session_id", "evaluation_reports", ["training_session_id"], unique=False)
    op.create_index("ix_evaluation_reports_knowledge_version_id", "evaluation_reports", ["knowledge_version_id"], unique=False)

    op.create_table(
        "review_decisions",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("report_id", sa.String(length=64), nullable=False),
        sa.Column("reviewer_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("corrected_verdict", sa.String(length=32), nullable=True),
        sa.Column("corrected_score", sa.Integer(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["report_id"], ["evaluation_reports.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_review_decisions_report_id", "review_decisions", ["report_id"], unique=False)
    op.create_index("ix_review_decisions_reviewer_id", "review_decisions", ["reviewer_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_review_decisions_reviewer_id", table_name="review_decisions")
    op.drop_index("ix_review_decisions_report_id", table_name="review_decisions")
    op.drop_table("review_decisions")
    op.drop_index("ix_evaluation_reports_knowledge_version_id", table_name="evaluation_reports")
    op.drop_index("ix_evaluation_reports_training_session_id", table_name="evaluation_reports")
    op.drop_table("evaluation_reports")
    op.drop_index("ix_training_messages_training_session_id", table_name="training_messages")
    op.drop_table("training_messages")
    op.drop_index("ix_training_sessions_status", table_name="training_sessions")
    op.drop_index("ix_training_sessions_scenario_version_id", table_name="training_sessions")
    op.drop_index("ix_training_sessions_knowledge_version_id", table_name="training_sessions")
    op.drop_index("ix_training_sessions_learner_id", table_name="training_sessions")
    op.drop_index("ix_training_sessions_assignment_id", table_name="training_sessions")
    op.drop_table("training_sessions")
    op.drop_index("ix_scenario_versions_status", table_name="scenario_versions")
    op.drop_index("ix_scenario_versions_knowledge_version_id", table_name="scenario_versions")
    op.drop_index("ix_scenario_versions_version_key", table_name="scenario_versions")
    op.drop_index("ix_scenario_versions_scenario_id", table_name="scenario_versions")
    op.drop_table("scenario_versions")
    op.drop_index("ix_scenarios_status", table_name="scenarios")
    op.drop_index("ix_scenarios_category", table_name="scenarios")
    op.drop_index("ix_scenarios_scenario_key", table_name="scenarios")
    op.drop_table("scenarios")
