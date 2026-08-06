from __future__ import annotations

from datetime import UTC, datetime
from hashlib import sha256
import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import KnowledgeUnit, KnowledgeVersion, Scenario, ScenarioVersion


class PublicationError(ValueError):
    def __init__(self, code: str, message: str, *, details: dict[str, object] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details


def payload_hash(payloads: list[dict[str, Any]]) -> str:
    canonical = json.dumps(payloads, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return sha256(canonical.encode("utf-8")).hexdigest()


def publish_phase4_templates(
    database: Session, payloads: list[dict[str, Any]]
) -> dict[str, int | str]:
    if not payloads:
        raise PublicationError("SCENARIO_INVALID_TEMPLATE", "场景导出不能为空。")
    for payload in payloads:
        _validate_payload(payload)

    knowledge_by_hash: dict[str, KnowledgeVersion] = {}
    for payload in payloads:
        knowledge_hash = str(payload["knowledge_version_hash"])
        knowledge = knowledge_by_hash.get(knowledge_hash)
        if knowledge is None:
            knowledge = database.scalars(
                select(KnowledgeVersion).where(
                    KnowledgeVersion.version_hash == knowledge_hash,
                    KnowledgeVersion.status == "published",
                    KnowledgeVersion.is_active.is_(True),
                )
            ).first()
            if knowledge is None:
                raise PublicationError(
                    "SCENARIO_KNOWLEDGE_VERSION_NOT_ACTIVE",
                    "场景引用的知识版本不是当前活动发布版本。",
                    details={"knowledge_version_hash": knowledge_hash},
                )
            knowledge_by_hash[knowledge_hash] = knowledge
        _check_source_locators(database, knowledge, payload)

    created_scenarios = 0
    created_versions = 0
    source_locators_checked = 0
    now = datetime.now(UTC)
    for payload in payloads:
        knowledge = knowledge_by_hash[str(payload["knowledge_version_hash"])]
        scenario = database.scalar(
            select(Scenario).where(Scenario.scenario_key == payload["scenario_key"])
        )
        if scenario is None:
            scenario = Scenario(
                id=str(payload["scenario_id"]),
                scenario_key=str(payload["scenario_key"]),
                title=str(payload["title"]),
                category=str(payload["category"]),
                summary=str(payload["summary"]),
                status="published",
            )
            database.add(scenario)
            created_scenarios += 1
        elif scenario.id != payload["scenario_id"]:
            raise PublicationError(
                "SCENARIO_ID_CONFLICT",
                "同一场景键已经绑定到不同的稳定 ID。",
                details={"scenario_key": payload["scenario_key"]},
            )
        else:
            scenario.title = str(payload["title"])
            scenario.category = str(payload["category"])
            scenario.summary = str(payload["summary"])
            scenario.status = "published"

        version = database.scalar(
            select(ScenarioVersion).where(ScenarioVersion.version_key == payload["version_key"])
        )
        if version is None:
            version = ScenarioVersion(
                id=str(payload["version_id"]),
                scenario_id=scenario.id,
                version_key=str(payload["version_key"]),
                version=int(payload.get("version", 1)),
                knowledge_version_id=knowledge.id,
            )
            database.add(version)
            created_versions += 1
        elif version.id != payload["version_id"] or version.scenario_id != scenario.id:
            raise PublicationError(
                "SCENARIO_VERSION_ID_CONFLICT",
                "同一场景版本键已经绑定到不同的稳定 ID。",
                details={"version_key": payload["version_key"]},
            )
        version.knowledge_version_id = knowledge.id
        version.background = str(payload.get("background", ""))
        version.summary = str(payload["summary"])
        version.opening_message = str(payload["opening_message"])
        version.controlled_variables = dict(payload.get("controlled_variables", {}))
        version.hidden_facts = list(payload["hidden_facts"])
        version.customer_turns = list(payload["customer_turns"])
        version.checkpoints = list(payload.get("checkpoints", []))
        version.prohibitions = list(payload.get("prohibitions", []))
        version.scoring_weights = {
            str(item["name"]): float(item["weight"])
            for item in payload["scoring_dimensions"]
        }
        version.scoring_dimensions = list(payload["scoring_dimensions"])
        version.critical_risks = list(payload["critical_risks"])
        version.reference_flow = list(payload["reference_flow"])
        version.reference_reply = str(payload["reference_reply"])
        version.sources = list(payload["source_locators"])
        version.max_turns = int(payload["max_turns"])
        version.mock_mode = bool(payload["mock_mode"])
        version.customer_persona = payload.get("customer_persona")
        version.difficulty = str(payload.get("difficulty", "medium"))
        version.scenario_focus = str(payload.get("scenario_focus", ""))
        version.status = "published"
        version.published_at = version.published_at or now
        source_locators_checked += len(payload["source_locators"])

    return {
        "source_hash": payload_hash(payloads),
        "created_scenarios": created_scenarios,
        "created_versions": created_versions,
        "source_locators_checked": source_locators_checked,
    }


def _validate_payload(payload: dict[str, Any]) -> None:
    required = (
        "scenario_id",
        "version_id",
        "scenario_key",
        "version_key",
        "knowledge_version_hash",
        "title",
        "category",
        "summary",
        "opening_message",
        "hidden_facts",
        "customer_turns",
        "scoring_dimensions",
        "critical_risks",
        "reference_flow",
        "reference_reply",
        "source_locators",
        "max_turns",
        "mock_mode",
        "status",
    )
    if any(key not in payload for key in required):
        raise PublicationError("SCENARIO_INVALID_TEMPLATE", "场景导出缺少必填字段。")
    dimensions = payload["scoring_dimensions"]
    if not isinstance(dimensions, list) or len(dimensions) != 5:
        raise PublicationError("SCENARIO_INVALID_TEMPLATE", "场景必须包含五个评分维度。")
    if sum(int(item.get("weight", 0)) for item in dimensions) != 100:
        raise PublicationError("SCENARIO_INVALID_TEMPLATE", "评分维度权重之和必须为100。")
    if not 8 <= int(payload["max_turns"]) <= 16:
        raise PublicationError("SCENARIO_INVALID_TEMPLATE", "场景最大轮数必须在8到16之间。")
    if payload["status"] != "published" or not payload["source_locators"]:
        raise PublicationError("SCENARIO_INVALID_TEMPLATE", "场景必须是已发布且包含来源定位。")
    if len(payload["hidden_facts"]) < 3 or len(payload["customer_turns"]) < 3:
        raise PublicationError("SCENARIO_INVALID_TEMPLATE", "场景隐藏事实和顾客轮次不足。")


def _check_source_locators(
    database: Session, knowledge: KnowledgeVersion, payload: dict[str, Any]
) -> None:
    units = database.scalars(
        select(KnowledgeUnit).where(
            KnowledgeUnit.knowledge_version_id == knowledge.id,
            KnowledgeUnit.can_use_for_scenario.is_(True),
        )
    ).all()
    for locator in payload["source_locators"]:
        source_path = locator.get("source_path")
        anchor = locator.get("anchor")
        found = any(
            any(
                source.get("source_path") == source_path
                and (not anchor or source.get("anchor") == anchor)
                for source in (unit.sources or [])
                if isinstance(source, dict)
            )
            for unit in units
        )
        if not found:
            raise PublicationError(
                "SCENARIO_SOURCE_NOT_FOUND",
                "场景来源定位未在活动知识版本中找到。",
                details={"source_path": source_path, "anchor": anchor},
            )
