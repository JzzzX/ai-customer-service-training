from io import BytesIO

import pytest
from openpyxl import Workbook
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Base, KnowledgeSource, KnowledgeUnit, KnowledgeVersion
from app.services.knowledge.compiler import compile_knowledge_sources
from app.services.knowledge.publication import KnowledgePublicationService
from app.services.knowledge.schema import SourceInput


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def workbook_bytes(answer: str) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "FAQ"
    sheet.append(["分类", "问题", "回复"])
    sheet.append(["物流", "多久发货？", answer])
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def conflicting_pack():
    return compile_knowledge_sources(
        [
            SourceInput(
                source_path="a.xlsx",
                kind="excel",
                content=workbook_bytes("48 小时内"),
            ),
            SourceInput(
                source_path="b.xlsx",
                kind="excel",
                content=workbook_bytes("24 小时内"),
            ),
        ],
        source_root="knowledge",
    )


def test_publication_is_idempotent_and_switches_the_active_version() -> None:
    database = make_session()
    service = KnowledgePublicationService(database)
    first_pack = conflicting_pack()

    first = service.publish(first_pack, label="第一版")
    database.commit()
    repeated = service.publish(first_pack, label="不会覆盖已有版本")
    database.commit()

    assert first.created is True
    assert repeated.created is False
    assert repeated.version_id == first.version_id
    assert database.scalar(select(KnowledgeVersion).where(KnowledgeVersion.is_active))
    assert database.query(KnowledgeSource).count() == 2
    quarantined = database.scalars(select(KnowledgeUnit)).all()
    assert len(quarantined) == 2
    assert all(unit.has_conflict for unit in quarantined)
    assert all(not unit.can_use_for_quiz for unit in quarantined)
    assert all(not unit.can_use_for_scenario for unit in quarantined)
    assert all(not unit.can_use_for_evaluation for unit in quarantined)

    second_pack = compile_knowledge_sources(
        [
            SourceInput(
                source_path="faq.md",
                kind="markdown",
                content="# 售后\n七天可退换".encode(),
            )
        ],
        source_root="knowledge",
    )
    second = service.publish(second_pack, label="第二版")
    database.commit()

    active_ids = database.scalars(
        select(KnowledgeVersion.id).where(KnowledgeVersion.is_active)
    ).all()
    assert second.created is True
    assert active_ids == [second.version_id]
    assert database.get(KnowledgeVersion, first.version_id).is_active is False


def test_publication_rejects_a_failed_coverage_gate() -> None:
    database = make_session()
    pack = compile_knowledge_sources(
        [SourceInput(source_path="faq.md", kind="markdown", content=b"# FAQ\nAnswer")],
        source_root="knowledge",
        expected={"source_files": 2},
    )

    with pytest.raises(ValueError, match="coverage gate"):
        KnowledgePublicationService(database).publish(pack, label="失败版本")

    assert database.query(KnowledgeVersion).count() == 0


def test_publication_rolls_back_when_source_paths_are_not_unique() -> None:
    database = make_session()
    pack = conflicting_pack()
    duplicated = pack.model_copy(
        update={"sources": [pack.sources[0], pack.sources[0]]}
    )

    with pytest.raises(IntegrityError):
        KnowledgePublicationService(database).publish(duplicated, label="重复来源")
        database.commit()
    database.rollback()

    assert database.query(KnowledgeVersion).count() == 0
