from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import requests

from config.settings import Settings


class FeishuOAuthError(RuntimeError):
    pass


@dataclass(frozen=True)
class FeishuProfile:
    union_id: str
    open_id: str
    email: str
    name: str


class FeishuOAuthClient:
    authorize_endpoint = "https://accounts.feishu.cn/open-apis/authen/v1/authorize"
    token_endpoint = "https://open.feishu.cn/open-apis/authen/v2/oauth/token"
    user_info_endpoint = "https://open.feishu.cn/open-apis/authen/v1/user_info"

    def __init__(self, settings: Settings, *, http: Any = requests) -> None:
        self.settings = settings
        self.http = http

    def authorization_url(self, state: str) -> str:
        query = urlencode(
            {
                "client_id": self.settings.feishu_app_client_id,
                "response_type": "code",
                "redirect_uri": self.settings.feishu_redirect_uri,
                "state": state,
            }
        )
        return f"{self.authorize_endpoint}?{query}"

    def exchange_code(self, code: str) -> FeishuProfile:
        token_response = self.http.post(
            self.token_endpoint,
            json={
                "grant_type": "authorization_code",
                "client_id": self.settings.feishu_app_client_id,
                "client_secret": self.settings.feishu_app_client_secret,
                "code": code,
                "redirect_uri": self.settings.feishu_redirect_uri,
            },
            timeout=10,
        )
        token_response.raise_for_status()
        access_token = token_response.json().get("access_token")
        if not access_token:
            raise FeishuOAuthError("Feishu did not return a user access token")

        user_response = self.http.get(
            self.user_info_endpoint,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        user_response.raise_for_status()
        payload = user_response.json()
        if payload.get("code") != 0:
            raise FeishuOAuthError("Feishu rejected the user info request")
        data = payload.get("data") or {}
        email = data.get("enterprise_email") or data.get("email") or ""
        if not data.get("union_id") or not data.get("open_id") or not email:
            raise FeishuOAuthError("Feishu user profile is incomplete")
        return FeishuProfile(
            union_id=data["union_id"],
            open_id=data["open_id"],
            email=email,
            name=data.get("name") or "飞书用户",
        )
