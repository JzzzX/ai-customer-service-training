import { customFetch } from "next-auth";
import { z } from "zod";

import { resolveFeishuUser } from "./user-repository";

const FEISHU_AUTHORIZATION_URL =
  "https://accounts.feishu.cn/open-apis/authen/v1/authorize" +
  "?scope=contact%3Auser.base%3Areadonly";
const FEISHU_TOKEN_URL =
  "https://open.feishu.cn/open-apis/authen/v2/oauth/token";
const FEISHU_USERINFO_URL =
  "https://open.feishu.cn/open-apis/authen/v1/user_info";

const rawFeishuProfileSchema = z.object({
  union_id: z.string().min(1),
  open_id: z.string().min(1),
  email: z.string().optional(),
  enterprise_email: z.string().optional(),
  user_email: z.string().optional(),
  name: z.string().optional(),
  en_name: z.string().optional(),
});

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

export function FeishuProvider() {
  const clientId = process.env.FEISHU_APP_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.FEISHU_APP_CLIENT_SECRET?.trim() ?? "";

  return {
    id: "feishu",
    name: "飞书",
    type: "oauth" as const,
    clientId,
    clientSecret,

    authorization: {
      url: FEISHU_AUTHORIZATION_URL,
      params: {
        response_type: "code",
      },
    },

    token: FEISHU_TOKEN_URL,
    userinfo: FEISHU_USERINFO_URL,

    // 与旧系统保持一致：OAuth state 必须校验。
    checks: ["state" as const],

    // 飞书 token 接口接收 JSON，而标准 OAuth 客户端通常提交 form。
    // 同时兼容飞书响应可能存在的 data 包装层。
    [customFetch]: createFeishuFetch(clientId, clientSecret),

    async profile(rawProfile: unknown) {
      const source = unwrapData(rawProfile);
      const profile = rawFeishuProfileSchema.parse(source);

      const email = (
        profile.email ??
        profile.enterprise_email ??
        profile.user_email ??
        ""
      )
        .trim()
        .toLowerCase();

      const user = resolveFeishuUser({
        unionId: profile.union_id,
        openId: profile.open_id,
        email,
      });

      if (!user) {
        throw new Error("FEISHU_ACCOUNT_NOT_BOUND");
      }

      return user;
    },
  };
}

function createFeishuFetch(
  clientId: string,
  clientSecret: string,
): typeof fetch {
  return async (
    input: FetchInput,
    init?: FetchInit,
  ): Promise<Response> => {
    const url = requestUrl(input);

    if (url === FEISHU_TOKEN_URL) {
      const params = await readRequestParams(input, init);

      const code = params.get("code")?.trim() ?? "";
      const redirectUri = params.get("redirect_uri")?.trim() ?? "";

      if (!code) {
        throw new Error("FEISHU_AUTHORIZATION_CODE_MISSING");
      }

      const payload: Record<string, string> = {
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
      };

      if (redirectUri) {
        payload.redirect_uri = redirectUri;
      }

      const headers = new Headers(init?.headers);
      headers.delete("authorization");
      headers.set("accept", "application/json");
      headers.set("content-type", "application/json; charset=utf-8");

      const response = await globalThis.fetch(FEISHU_TOKEN_URL, {
        ...init,
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      return normalizeFeishuJsonResponse(response);
    }

    if (url === FEISHU_USERINFO_URL) {
      const response = await globalThis.fetch(input, init);
      return normalizeFeishuJsonResponse(response);
    }

    return globalThis.fetch(input, init);
  };
}

function requestUrl(input: FetchInput): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

async function readRequestParams(
  input: FetchInput,
  init?: FetchInit,
): Promise<URLSearchParams> {
  const body = init?.body;

  if (body instanceof URLSearchParams) {
    return body;
  }

  if (typeof body === "string") {
    return new URLSearchParams(body);
  }

  if (typeof Request !== "undefined" && input instanceof Request) {
    const text = await input.clone().text();
    return new URLSearchParams(text);
  }

  return new URLSearchParams();
}

async function normalizeFeishuJsonResponse(
  response: Response,
): Promise<Response> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("json")) {
    return response;
  }

  const payload = await response.clone().json();

  if (
    payload &&
    typeof payload === "object" &&
    "code" in payload &&
    typeof payload.code === "number" &&
    payload.code !== 0
  ) {
    return jsonResponse(payload, response, 400);
  }

  return jsonResponse(unwrapData(payload), response, response.status);
}

function jsonResponse(
  payload: unknown,
  original: Response,
  status: number,
): Response {
  const headers = new Headers(original.headers);
  headers.set("content-type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(payload), {
    status,
    statusText: original.statusText,
    headers,
  });
}

function unwrapData(value: unknown): unknown {
  if (
    value &&
    typeof value === "object" &&
    "data" in value &&
    value.data &&
    typeof value.data === "object"
  ) {
    return value.data;
  }

  return value;
}
