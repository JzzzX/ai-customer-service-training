import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, KnowledgeUnit, KnowledgeVersion, Scenario, ScenarioVersion
from app.services.scenario.publication import PublicationError, publish_phase4_templates


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def template_payload(*, knowledge_hash: str = "k" * 64, source_path: str = "faq.md") -> dict:
    return {
        "scenario_id": "st_111111111111111111111111",
        "version_id": "sv_111111111111111111111111",
        "scenario_key": "returns",
        "version_key": "returns-v1",
        "knowledge_version_hash": knowledge_hash,
        "title": "退货咨询",
        "category": "presale",
        "summary": "处理退货时效咨询",
        "opening_message": "您好，请问有什么可以帮您？",
        "hidden_facts": ["订单已签收", "购买七天内", "保留包装"],
        "customer_turns": ["我想退货", "需要什么材料？", "多久能处理？"],
        "scoring_dimensions": [
            {"name": f"维度{i}", "weight": weight, "signals": ["确认", "说明"]}
            for i, weight in enumerate([25, 20, 20, 20, 15], start=1)
        ],
        "critical_risks": [
            {"label": "虚构承诺", "patterns": ["保证"]},
            {"label": "违规赔付", "patterns": ["随便赔"]},
        ],
        "reference_flow": ["确认订单", "说明规则", "收集凭证", "约定跟进"],
        "reference_reply": "请提供订单号，我帮您核实。",
        "source_locators": [{"source_path": source_path, "anchor": "h:退货"}],
        "max_turns": 12,
        "mock_mode": True,
        "difficulty": "easy",
        "status": "published",
    }


def seed_knowledge(database: Session, *, active: bool = True) -> None:
    version = KnowledgeVersion(
        id="knowledge-1",
        version_hash="k" * 64,
        label="正式知识库",
        status="published" if active else "draft",
        is_active=active,
    )
    version.units.append(
        KnowledgeUnit(
            id="unit-1",
            unit_key="returns",
            title="退货",
            content="退货规则",
            category_path=["售后"],
            content_hash="u" * 64,
            sources=[{"source_path": "faq.md", "anchor": "h:退货"}],
        )
    )
    database.add(version)
    database.commit()


def test_publication_requires_source_locator_in_active_knowledge() -> None:
    database = make_session()
    seed_knowledge(database)

    with pytest.raises(PublicationError) as error:
        publish_phase4_templates(database, [template_payload(source_path="missing.md")])

    assert error.value.code == "SCENARIO_SOURCE_NOT_FOUND"
    assert database.query(Scenario).count() == 0


def test_publication_rejects_inactive_knowledge_version() -> None:
    database = make_session()
    seed_knowledge(database, active=False)

    with pytest.raises(PublicationError) as error:
        publish_phase4_templates(database, [template_payload()])

    assert error.value.code == "SCENARIO_KNOWLEDGE_VERSION_NOT_ACTIVE"


def test_publication_is_idempotent_and_preserves_stable_ids() -> None:
    database = make_session()
    seed_knowledge(database)
    payload = template_payload()

    first = publish_phase4_templates(database, [payload])
    database.commit()
    second = publish_phase4_templates(database, [payload])
    database.commit()

    assert first["created_scenarios"] == 1
    assert first["created_versions"] == 1
    assert second["created_scenarios"] == 0
    assert second["created_versions"] == 0
    assert database.get(Scenario, payload["scenario_id"]).scenario_key == "returns"
    assert database.get(ScenarioVersion, payload["version_id"]).scenario_id == payload["scenario_id"]


def test_publication_rejects_invalid_scoring_weights_before_writing() -> None:
    database = make_session()
    seed_knowledge(database)
    payload = template_payload()
    payload["scoring_dimensions"][0]["weight"] = 26

    with pytest.raises(PublicationError) as error:
        publish_phase4_templates(database, [payload])

    assert error.value.code == "SCENARIO_INVALID_TEMPLATE"
    assert database.query(Scenario).count() == 0
