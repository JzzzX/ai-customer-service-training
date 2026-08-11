"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { isDemoMode } from "@/lib/runtime/mode";

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
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "邮箱或密码不正确，请重新输入。" };
    }
    throw error;
  }

  redirect("/login/continue");
}

export async function demoLoginAction(): Promise<void> {
  if (!isDemoMode()) {
    redirect("/login");
  }

  try {
    await signIn("demo", { redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login");
    }
    throw error;
  }

  redirect("/login/continue");
}
