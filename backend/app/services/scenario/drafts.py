from __future__ import annotations

from app.core.errors import AppError
from app.services.scenario.ark import ArkScenarioProvider
from app.services.scenario.providers import ProviderError
from config.settings import Settings, get_settings


CATEGORY_LABELS = {
    "presale": "售前咨询",
    "logistics": "物流问题",
    "damage_shortage": "破损少货",
    "complaint": "客诉处理",
}


def generate_scenario_drafts(
    category: str, count: int, *, settings: Settings | None = None
) -> list[dict[str, object]]:
    settings = settings or get_settings()
    if settings.scenario_ai_mode == "ark":
        try:
            return ArkScenarioProvider(settings).generate_scenario_drafts(category, count)
        except ProviderError as error:
            raise AppError(
                code=error.code,
                message=error.message,
                status_code=503 if error.retryable else 409,
                details=error.details,
            ) from error
    label = CATEGORY_LABELS[category]
    return [
        {
            "id": f"draft-{category}-{index + 1}",
            "category": category,
            "title": f"{label}训练场景 {index + 1}",
            "summary": f"围绕{label}的事实核验、处理路径和风险沟通。",
            "opening_message": "您好，我遇到一个问题，希望您帮我处理。",
            "reference_reply": "我先核实订单和政策，再向您说明明确的处理节点。",
            "hidden_facts": ["订单信息需要核验"],
            "reference_flow": ["确认事实", "说明政策", "给出跟进节点"],
            "scoring_dimensions": [
                {"name": "事实核验", "weight": 40, "signals": ["确认"]},
                {"name": "处理路径", "weight": 60, "signals": ["跟进"]},
            ],
            "critical_risks": [
                {"label": "未经核实的承诺", "patterns": ["保证马上"]}
            ],
            "difficulty": "medium",
            "customer_persona": {"temperament": "anxious", "mood": "焦虑"},
        }
        for index in range(count)
    ]
