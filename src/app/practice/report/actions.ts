"use server";

import { redirect } from "next/navigation";
import { requireLearner } from "@/lib/auth/guards";
import { generateRemediationExam } from "@/lib/remediation/service";
import { parseReportRange } from "@/lib/report/service";

export async function generateRemediationExamAction(formData: FormData) {
  const learner = await requireLearner();
  const range = parseReportRange({
    preset: String(formData.get("preset") ?? "today"),
    start: formData.get("start") ? String(formData.get("start")) : undefined,
    end: formData.get("end") ? String(formData.get("end")) : undefined,
  });
  const result = generateRemediationExam(learner.id, range);
  if (result.status === "created" || result.status === "existing") return redirect(`/practice/remediation/${result.exam.id}`);
  if (result.status === "no_weakness") return redirect("/practice/report?remediation=no-weakness");
  if (result.status === "insufficient_bank") return redirect(`/practice/report?remediation=insufficient-bank&category=${encodeURIComponent(result.category)}&required=${result.required}&available=${result.available}`);
  throw new Error("无法生成改善考卷。");
}
