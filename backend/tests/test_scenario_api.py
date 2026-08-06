import json
from collections.abc import Generator
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.dependencies import get_current_user, get_session
from app.models import Base, KnowledgeVersion, Scenario, ScenarioVersion, User
from main import create_app


def make_client(*, authenticated: bool = True) -> tuple[TestClient, sessionmaker[Session]]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    app = create_app()

    def session_override() -> Generator[Session, None, None]:
        database = sessions()
        try:
            yield database
            database.commit()
        finally:
            database.close()

    app.dependency_overrides[get_session] = session_override
    if authenticated:
        app.dependency_overrides[get_current_user] = lambda: sessions().get(User, "learner-1")
    return TestClient(app), sessions


def seed(sessions: sessionmaker[Session]) -> None:
    database = sessions()
    database.add_all(
        [
            User(id="learner-1", email="one@example.test", name="一号", role="learner", is_active=True),
            KnowledgeVersion(id="knowledge-1", version_hash="k" * 64, label="知识", status="published", is_active=True),
            Scenario(id="scenario-1", scenario_key="returns", title="退货咨询", category="presale", summary="处理退货", status="published"),
        ]
    )
    database.flush()
    database.add(
        ScenarioVersion(
            id="version-1",
            scenario_id="scenario-1",
            version_key="returns-v1",
            version=1,
            knowledge_version_id="knowledge-1",
            summary="处理退货",
            opening_message="您好，请问有什么可以帮您？",
            customer_turns=["我想退货", "需要什么材料？", "多久能处理？"],
            scoring_dimensions=[
                {"name": "需求确认", "weight": 25, "signals": ["订单", "确认"]},
                {"name": "规则说明", "weight": 20, "signals": ["规则", "说明"]},
                {"name": "处理路径", "weight": 20, "signals": ["工单", "联系"]},
                {"name": "沟通体验", "weight": 20, "signals": ["理解", "抱歉"]},
                {"name": "闭环", "weight": 15, "signals": ["跟进", "确认"]},
            ],
            scoring_weights={},
            critical_risks=[{"label": "虚构承诺", "patterns": ["保证今天到"]}],
            reference_flow=["确认订单", "说明规则", "约定跟进", "确认结束"],
            reference_reply="请提供订单号，我帮您核实。",
            sources=[],
            max_turns=12,
            status="published",
            published_at=datetime(2026, 8, 6, tzinfo=UTC),
        )
    )
    database.commit()
    database.close()


def test_scenario_api_requires_auth_and_hides_private_template_facts() -> None:
    anonymous, _ = make_client(authenticated=False)
    assert anonymous.get("/api/v1/scenarios").status_code == 401

    client, sessions = make_client()
    seed(sessions)
    response = client.get("/api/v1/scenarios")

    assert response.status_code == 200
    body = response.json()
    assert body["items"][0]["id"] == "scenario-1"
    assert "hidden_facts" not in body["items"][0]


def test_scenario_api_starts_restores_sends_and_streams_report() -> None:
    client, sessions = make_client()
    seed(sessions)

    started = client.post("/api/v1/scenarios/scenario-1/sessions")
    assert started.status_code == 201
    session_id = started.json()["id"]
    sent = client.post(
        f"/api/v1/scenario-sessions/{session_id}/messages",
        json={"content": "我先确认订单并说明规则，后续跟进。", "expected_turn_count": 0},
    )
    assert sent.status_code == 200
    assert sent.json()["session"]["turn_count"] == 1

    restored = client.get(f"/api/v1/scenario-sessions/{session_id}")
    assert restored.status_code == 200
    assert len(restored.json()["messages"]) == 3

    stream = client.post(f"/api/v1/scenario-sessions/{session_id}/report/stream")
    assert stream.status_code == 200
    assert stream.headers["content-type"].startswith("text/event-stream")
    assert "event: analyzing" in stream.text
    assert "event: scoring" in stream.text
    assert "event: report" in stream.text
    assert "total_score" in stream.text


def test_scenario_history_status_filter_and_cursor() -> None:
    client, sessions = make_client()
    seed(sessions)
    started = client.post("/api/v1/scenarios/scenario-1/sessions").json()
    client.post(
        f"/api/v1/scenario-sessions/{started['id']}/messages",
        json={"content": "我确认订单。", "expected_turn_count": 0},
    )

    active = client.get("/api/v1/me/scenario-history?status=active&limit=20")
    completed = client.get("/api/v1/me/scenario-history?status=completed&limit=20")
    sessions_page = client.get("/api/v1/me/scenario-history/scenario-1/sessions?limit=1")

    assert active.status_code == 200
    assert active.json()["groups"][0]["active_session_count"] == 1
    assert completed.json()["groups"] == []
    assert sessions_page.json()["items"][0]["status"] == "active"
