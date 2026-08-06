from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.services.scenario.publication import payload_hash, publish_phase4_templates


def migrate_phase4(database: Session, payloads: list[dict[str, Any]]) -> dict[str, int | str]:
    result = publish_phase4_templates(database, payloads)
    return {
        **result,
        "target_hash": payload_hash(payloads),
        "scenarios": len({str(payload["scenario_key"]) for payload in payloads}),
        "scenario_versions": len({str(payload["version_key"]) for payload in payloads}),
    }


__all__ = ["migrate_phase4", "payload_hash"]
