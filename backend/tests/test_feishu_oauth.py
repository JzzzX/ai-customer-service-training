from app.utils.feishu_oauth import FeishuOAuthClient
from config.settings import Settings


def settings() -> Settings:
    return Settings(
        app_env="test",
        database_url="sqlite+pysqlite:///:memory:",
        feishu_app_client_id="cli_test",
        feishu_app_client_secret="secret",
        feishu_redirect_uri="http://localhost:8005/api/v1/auth/feishu/callback",
    )


def test_authorization_url_uses_current_feishu_oauth_endpoint() -> None:
    url = FeishuOAuthClient(settings()).authorization_url("state-value")

    assert url.startswith("https://accounts.feishu.cn/open-apis/authen/v1/authorize?")
    assert "client_id=cli_test" in url
    assert "response_type=code" in url
    assert "state=state-value" in url


def test_exchange_reads_union_and_open_ids_from_user_info() -> None:
    http = FakeHttp()

    profile = FeishuOAuthClient(settings(), http=http).exchange_code("code-1")

    assert http.post_url.endswith("/authen/v2/oauth/token")
    assert http.post_json["grant_type"] == "authorization_code"
    assert http.get_headers == {"Authorization": "Bearer user-token"}
    assert profile.union_id == "on_union_1"
    assert profile.open_id == "ou_open_1"
    assert profile.email == "learner@example.test"


class FakeResponse:
    def __init__(self, payload: dict) -> None:
        self.payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self.payload


class FakeHttp:
    post_url = ""
    post_json: dict = {}
    get_headers: dict = {}

    def post(self, url: str, *, json: dict, timeout: int) -> FakeResponse:
        self.post_url = url
        self.post_json = json
        return FakeResponse({"access_token": "user-token"})

    def get(self, url: str, *, headers: dict, timeout: int) -> FakeResponse:
        self.get_headers = headers
        return FakeResponse(
            {
                "code": 0,
                "data": {
                    "union_id": "on_union_1",
                    "open_id": "ou_open_1",
                    "email": "learner@example.test",
                    "name": "测试学员",
                },
            }
        )
