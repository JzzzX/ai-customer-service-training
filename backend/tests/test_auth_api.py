from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.auth import get_feishu_client
from app.core.dependencies import get_session
from app.models import Base, User
from app.utils.feishu_oauth import FeishuProfile
from config.settings import Settings, get_settings
from main import create_app


def make_client() -> tuple[TestClient, sessionmaker[Session]]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    settings = Settings(
        app_env="test",
        database_url="sqlite+pysqlite:///:memory:",
        frontend_origin="http://localhost:8006",
        feishu_app_client_id="cli_test",
        feishu_app_client_secret="secret",
        jwt_secret="test-secret-that-is-long-enough-for-signing",
    )
    app = create_app()

    def session_override() -> Generator[Session, None, None]:
        database = sessions()
        try:
            yield database
            database.commit()
        finally:
            database.close()

    app.dependency_overrides[get_session] = session_override
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_feishu_client] = lambda: FakeFeishuClient()
    return TestClient(app, raise_server_exceptions=False), sessions


def test_me_requires_an_http_only_access_cookie() -> None:
    client, _ = make_client()

    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["code"] == "AUTH_REQUIRED"


def test_feishu_callback_binds_user_and_sets_session_cookies() -> None:
    client, sessions = make_client()
    with sessions() as database:
        database.add(
            User(
                id="00000000-0000-4000-8000-000000000002",
                email="learner@example.test",
                name="测试学员",
                role="learner",
                is_active=True,
            )
        )
        database.commit()
    login = client.get("/api/v1/auth/feishu/login", follow_redirects=False)
    state = login.cookies["oauth_state"]
    from app.core.security import decode_token

    state_value = decode_token(
        state,
        expected_type="oauth_state",
        settings=client.app.dependency_overrides[get_settings](),
    ).subject

    callback = client.get(
        f"/api/v1/auth/feishu/callback?code=code-1&state={state_value}",
        follow_redirects=False,
    )

    assert callback.status_code == 307
    assert callback.headers["location"] == "http://localhost:8006/"
    assert callback.cookies["access_token"]
    assert callback.cookies["refresh_token"]
    me = client.get("/api/v1/auth/me")
    assert me.json() == {
        "id": "00000000-0000-4000-8000-000000000002",
        "email": "learner@example.test",
        "name": "测试学员",
        "role": "learner",
    }


def test_test_login_sets_a_session_only_in_test_environment() -> None:
    client, sessions = make_client()
    with sessions() as database:
        database.add(
            User(
                id="e2e-learner",
                email="e2e@example.test",
                name="端到端学员",
                role="learner",
                is_active=True,
            )
        )
        database.commit()

    response = client.post("/api/v1/auth/test-login")

    assert response.status_code == 204
    current_user = client.get("/api/v1/auth/me")
    assert current_user.status_code == 200
    assert current_user.json()["id"] == "e2e-learner"


class FakeFeishuClient:
    def authorization_url(self, state: str) -> str:
        return f"https://accounts.feishu.cn/oauth?state={state}"

    def exchange_code(self, code: str) -> FeishuProfile:
        return FeishuProfile(
            union_id="on_union_1",
            open_id="ou_open_1",
            email="learner@example.test",
            name="测试学员",
        )
