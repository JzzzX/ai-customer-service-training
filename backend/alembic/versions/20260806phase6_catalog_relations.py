"""preserve legacy quiz relations and question reviews

Revision ID: 20260806phase6catalog
Revises: 20260806phase5
Create Date: 2026-08-06

"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260806phase6catalog"
down_revision: str | None = "20260806phase5"
branch_labels: Sequence[str] | None = None
depends_on: str | None = None


def upgrade() -> None:
    with op.batch_alter_table("questions") as batch_op:
        batch_op.alter_column(
            "quiz_set_id",
            existing_type=sa.String(length=64),
            nullable=True,
        )
    op.create_table(
        "quiz_set_questions",
        sa.Column("quiz_set_id", sa.String(length=64), nullable=False),
        sa.Column("question_id", sa.String(length=64), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("points", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(
            ["quiz_set_id"], ["quiz_sets.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["question_id"], ["questions.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("quiz_set_id", "question_id"),
    )
    op.create_index(
        "ix_quiz_set_questions_question_id",
        "quiz_set_questions",
        ["question_id"],
        unique=False,
    )
    op.execute(
        sa.text(
            "INSERT INTO quiz_set_questions (quiz_set_id, question_id, position, points) "
            "SELECT quiz_set_id, id, position, 1 FROM questions "
            "WHERE quiz_set_id IS NOT NULL"
        )
    )
    op.create_table(
        "question_reviews",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("question_id", sa.String(length=64), nullable=False),
        sa.Column("reviewer_id", sa.String(length=36), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["question_id"], ["questions.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["reviewer_id"], ["users.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "question_id", "content_hash", name="uq_question_reviews_question_hash"
        ),
    )
    op.create_index(
        "ix_question_reviews_question_id",
        "question_reviews",
        ["question_id"],
        unique=False,
    )
    op.create_index(
        "ix_question_reviews_reviewer_id",
        "question_reviews",
        ["reviewer_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_question_reviews_reviewer_id", table_name="question_reviews")
    op.drop_index("ix_question_reviews_question_id", table_name="question_reviews")
    op.drop_table("question_reviews")
    op.drop_index(
        "ix_quiz_set_questions_question_id", table_name="quiz_set_questions"
    )
    op.drop_table("quiz_set_questions")
    with op.batch_alter_table("questions") as batch_op:
        batch_op.alter_column(
            "quiz_set_id",
            existing_type=sa.String(length=64),
            nullable=False,
        )
