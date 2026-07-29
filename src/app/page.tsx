import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col">
        <header className="flex items-center gap-3" aria-label="产品标识">
          <span
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-[14px] bg-[#58cc78] text-lg font-black text-white shadow-[0_4px_0_#3cab5b]"
          >
            AI
          </span>
          <div>
            <p className="text-base font-bold text-[#21312a]">客服训练助手</p>
            <p className="text-xs text-[#6d7e74]">宠物食品新人学习中心</p>
          </div>
        </header>

        <section className="flex flex-1 flex-col justify-center py-14 sm:py-20">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-bold tracking-[0.12em] text-[#399a57]">
              今天，从一小步开始
            </p>
            <h1 className="text-4xl font-black tracking-[-0.04em] text-[#1f3027] sm:text-6xl">
              AI 客服训练
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#607168] sm:text-lg">
              用知识小测熟悉产品与服务规则，再通过情景对练练习真实接待。
              每次只聚焦一件事，学完就能用。
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <article className="group rounded-[28px] border-2 border-[#dce8df] bg-white p-6 shadow-[0_7px_0_#dce8df] transition-transform hover:-translate-y-0.5 sm:p-7">
              <div
                aria-hidden="true"
                className="grid size-12 place-items-center rounded-2xl bg-[#e9f8ed] text-2xl text-[#399a57]"
              >
                ✓
              </div>
              <p className="mt-5 text-xs font-bold tracking-[0.12em] text-[#399a57]">
                基础训练
              </p>
              <h2 className="mt-2 text-2xl font-black text-[#21312a]">
                知识小测
              </h2>
              <p className="mt-3 min-h-14 leading-7 text-[#68786f]">
                选择题与判断题，覆盖产品卖点、宠物知识和客服流程。
              </p>
              <Link
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#58cc78] px-5 font-bold text-white shadow-[0_4px_0_#3cab5b] transition-transform active:translate-y-1 active:shadow-none"
                href="/practice/quiz"
              >
                开始知识小测
              </Link>
            </article>

            <article className="group rounded-[28px] border-2 border-[#dde4ef] bg-white p-6 shadow-[0_7px_0_#dde4ef] transition-transform hover:-translate-y-0.5 sm:p-7">
              <div
                aria-hidden="true"
                className="grid size-12 place-items-center rounded-2xl bg-[#eef3ff] text-2xl text-[#5c7cdb]"
              >
                ◌
              </div>
              <p className="mt-5 text-xs font-bold tracking-[0.12em] text-[#5c7cdb]">
                对话训练
              </p>
              <h2 className="mt-2 text-2xl font-black text-[#21312a]">
                情景实战
              </h2>
              <p className="mt-3 min-h-14 leading-7 text-[#68786f]">
                模拟顾客提问，练习售前推荐、物流、客诉与售后衔接。
              </p>
              <Link
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#6c8bea] px-5 font-bold text-white shadow-[0_4px_0_#526fc6] transition-transform active:translate-y-1 active:shadow-none"
                href="/practice/scenario"
              >
                进入情景实战
              </Link>
            </article>
          </div>

          <p className="mt-7 text-center text-sm text-[#7a8981]">
            训练内容来自已整理的售前客服知识库
          </p>
        </section>
      </div>
    </main>
  );
}
