"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/auth";

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/practice",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "邮箱或密码不正确，请重新输入。" };
    }
    throw error;
  }
}
