import hashlib
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import KnowledgeSource, KnowledgeUnit, KnowledgeVersion
from app.repositories.knowledge import KnowledgeRepository
from app.services.knowledge.schema import KnowledgePack, SourceLocator


@dataclass(frozen=True)
class PublicationResult:
    version_id: str
    pack_hash: str
    source_count: int
    unit_count: int
    conflict_count: int
    created: bool


class KnowledgePublicationService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = KnowledgeRepository(session)

    def publish(self, pack: KnowledgePack, *, label: str) -> PublicationResult:
        if not pack.gate.passed:
            raise ValueError("Knowledge pack failed the coverage gate.")
        existing = self.repository.find_version_by_hash(pack.pack_hash)
        if existing:
            return self._result(existing, created=False)

        version_id = "kv_" + pack.pack_hash[:24]
        conflict_sources = {
            _locator_key(source)
            for issue in pack.issues
            if issue.code == "conflict"
            for source in issue.sources
        }
        version = KnowledgeVersion(
            id=version_id,
            version_hash=pack.pack_hash,
            label=label.strip(),
            schema_version=pack.schema_version,
            source_root=pack.source_root,
            coverage=pack.coverage,
            status="published",
            is_active=True,
        )
        version.sources = [
            KnowledgeSource(
                id=_stable_id("ks", version_id, source.source_path),
                source_path=source.source_path,
                kind=source.kind,
                source_hash=source.source_hash,
                bytes=source.bytes,
                stats=source.stats,
            )
            for source in pack.sources
        ]
        version.units = []
        for unit in pack.units:
            has_conflict = any(
                _locator_key(source) in conflict_sources for source in unit.sources
            )
            version.units.append(
                KnowledgeUnit(
                    id=_stable_id("kudb", version_id, unit.id),
                    unit_key=unit.id,
                    title=unit.title,
                    content=unit.content,
                    category_path=unit.category_path,
                    semantic_key=unit.semantic_key,
                    content_hash=unit.content_hash,
                    sources=[source.model_dump(mode="json") for source in unit.sources],
                    has_conflict=has_conflict,
                    can_use_for_quiz=not has_conflict,
                    can_use_for_scenario=not has_conflict,
                    can_use_for_evaluation=not has_conflict,
                )
            )

        self.repository.deactivate_active_versions()
        self.repository.add_version(version)
        self.session.flush()
        return PublicationResult(
            version_id=version.id,
            pack_hash=pack.pack_hash,
            source_count=len(version.sources),
            unit_count=len(version.units),
            conflict_count=sum(unit.has_conflict for unit in version.units),
            created=True,
        )

    def _result(
        self, version: KnowledgeVersion, *, created: bool
    ) -> PublicationResult:
        source_count = self.session.scalar(
            select(func.count(KnowledgeSource.id)).where(
                KnowledgeSource.knowledge_version_id == version.id
            )
        ) or 0
        unit_count = self.session.scalar(
            select(func.count(KnowledgeUnit.id)).where(
                KnowledgeUnit.knowledge_version_id == version.id
            )
        ) or 0
        conflict_count = self.session.scalar(
            select(func.count(KnowledgeUnit.id)).where(
                KnowledgeUnit.knowledge_version_id == version.id,
                KnowledgeUnit.has_conflict.is_(True),
            )
        ) or 0
        return PublicationResult(
            version_id=version.id,
            pack_hash=version.version_hash or version.id,
            source_count=source_count,
            unit_count=unit_count,
            conflict_count=conflict_count,
            created=created,
        )


def _stable_id(prefix: str, *parts: str) -> str:
    digest = hashlib.sha256("\0".join(parts).encode("utf-8")).hexdigest()
    return f"{prefix}_{digest[:24]}"


def _locator_key(source: SourceLocator) -> str:
    return f"{source.source_path}\0{source.anchor}"
