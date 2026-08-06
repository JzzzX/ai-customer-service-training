from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base
from app.models.user import User


class AdminAuditEvent(Base):
    __tablename__ = "admin_audit_events"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"audit_{uuid4().hex}"
    )
    actor_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    action: Mapped[str] = mapped_column(String(64), index=True)
    resource_type: Mapped[str] = mapped_column(String(64), index=True)
    resource_id: Mapped[str] = mapped_column(String(64), index=True)
    details: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    actor: Mapped["User"] = relationship()
