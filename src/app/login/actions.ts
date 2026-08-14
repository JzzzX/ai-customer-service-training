"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { isDemoMode } from "@/lib/runtime/mode";

export async function feishuLoginAction(): Promise<void> {
  await signIn("feishu", {
    redirectTo: "/login/continue",
  });
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
