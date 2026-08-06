from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import KnowledgeVersion


class KnowledgeRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def find_version_by_hash(self, version_hash: str) -> KnowledgeVersion | None:
        return self.session.scalar(
            select(KnowledgeVersion).where(
                KnowledgeVersion.version_hash == version_hash
            )
        )

    def deactivate_active_versions(self) -> None:
        self.session.execute(
            update(KnowledgeVersion)
            .where(KnowledgeVersion.is_active.is_(True))
            .values(is_active=False)
        )

    def add_version(self, version: KnowledgeVersion) -> None:
        self.session.add(version)
