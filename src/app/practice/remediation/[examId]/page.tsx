import { PageHeader } from "@/components/ui/page-header";
import { SoftCard } from "@/components/ui/soft-card";
import Link from "next/link";
import { QuizRunner } from "@/components/quiz/quiz-runner";
import { requireLearner } from "@/lib/auth/guards";
import { loadQuizAttemptSnapshotForLearner } from "@/lib/quiz/attempt-service";
import { shuffleClientQuestionOptions, toClientQuizQuestion } from "@/lib/quiz/schema";
import { loadRemediationExam } from "@/lib/remediation/service";
import { checkRemediationAnswerAction, saveRemediationExamAction } from "./actions";

export default async function RemediationExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const learner = await requireLearner(); const { examId } = await params;
  const exam = loadRemediationExam(learner.id, examId);
  if (exam.status === "completed" && exam.result) {
    return <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8"><div className="mx-auto max-w-3xl">
      <PageHeader backHref="/practice/report" badge="双 80% 改善标准" label="薄弱点训练" title="改善考卷结果" description="结果按生成时固定的题目版本判定。" />
      <SoftCard className="mt-8 text-center" gradient><h2 className="text-3xl font-black text-ink">{exam.result.improved ? "已改善" : "仍需巩固"}</h2><p className="mt-3 text-5xl font-black text-success">{exam.result.totalScore}%</p><p className="mt-4 text-sm text-ink-soft">{exam.result.categories.map((item) => `${item.category} ${item.accuracy}%`).join(" · ")}</p><Link className="mt-6 inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-ink px-5 font-bold text-white" href="/practice/report">返回整体报告</Link></SoftCard>
    </div></main>;
  }
  const snapshot = await loadQuizAttemptSnapshotForLearner(learner.id, exam.attemptId);
  return <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8"><div className="mx-auto max-w-3xl">
    <PageHeader backHref="/practice/report" badge="双 80% 改善标准" label="薄弱点训练" title="薄弱点改善考卷" description={`目标：${exam.targets.map((item) => item.category).join("、")}。总分及每个目标分类均达到 80% 才视为改善。`} />
    <div className="mt-8"><QuizRunner attemptId={exam.attemptId} questions={snapshot.questions.map((q) => shuffleClientQuestionOptions(toClientQuizQuestion(q)))} passingScore={80} onAnswer={checkRemediationAnswerAction.bind(null, examId)} onComplete={saveRemediationExamAction.bind(null, examId)} resultBackHref="/practice/report" /></div>
  </div></main>;
}
