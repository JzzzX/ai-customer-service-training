import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="max-w-md text-center">
        <div
          aria-hidden="true"
          className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff3f1] text-2xl"
        >
          !
        </div>
        <h1 className="mt-5 text-3xl font-black text-[#21312a]">
          这个区域仅管理员可用
        </h1>
        <p className="mt-3 leading-7 text-[#68786f]">
          你的账号可以继续完成知识小测和情景训练。
        </p>
        <Link
          className="mt-7 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#58cc78] px-5 font-bold text-white shadow-[0_4px_0_#3cab5b]"
          href="/practice"
        >
          返回训练中心
        </Link>
      </section>
    </main>
  );
}
