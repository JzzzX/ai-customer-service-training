import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/guards";

export default async function LoginContinuePage() {
  const user = await requireUser();
  redirect(user.role === "admin" ? "/admin" : "/practice");
}
