"""create phase 5 admin audit events

Revision ID: 20260806phase5
Revises: 20260806phase4
"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260806phase5"
down_revision: str | None = "20260806phase4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "admin_audit_events",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("actor_id", sa.String(length=36), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("resource_type", sa.String(length=64), nullable=False),
        sa.Column("resource_id", sa.String(length=64), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_admin_audit_events_actor_id", "admin_audit_events", ["actor_id"], unique=False
    )
    op.create_index(
        "ix_admin_audit_events_action", "admin_audit_events", ["action"], unique=False
    )
    op.create_index(
        "ix_admin_audit_events_resource_type",
        "admin_audit_events",
        ["resource_type"],
        unique=False,
    )
    op.create_index(
        "ix_admin_audit_events_resource_id",
        "admin_audit_events",
        ["resource_id"],
        unique=False,
    )
    op.create_index(
        "ix_admin_audit_events_created_at",
        "admin_audit_events",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_admin_audit_events_created_at", table_name="admin_audit_events")
    op.drop_index("ix_admin_audit_events_resource_id", table_name="admin_audit_events")
    op.drop_index("ix_admin_audit_events_resource_type", table_name="admin_audit_events")
    op.drop_index("ix_admin_audit_events_action", table_name="admin_audit_events")
    op.drop_index("ix_admin_audit_events_actor_id", table_name="admin_audit_events")
    op.drop_table("admin_audit_events")
