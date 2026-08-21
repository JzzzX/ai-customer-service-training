import { redirect } from "next/navigation";
import { requireLearner } from "@/lib/auth/guards";

export default async function PracticeHistoryPage() {
  await requireLearner();
  redirect("/practice/profile?tab=quiz");
}
