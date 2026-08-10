"use client";

export function ErrorPanel({
  message,
  reset,
}: {
  message: string;
  reset: () => void;
}) {
  return (
    <main className="min-h-screen px-5 py-16">
      <section className="mx-auto max-w-xl rounded-[28px] border-2 border-[#eadfd8] bg-white p-8 text-center">
        <p className="text-sm font-bold text-[#a35f43]">遇到了一点问题</p>
        <h1 className="mt-3 text-2xl font-black text-[#21312a]">
          {message}
        </h1>
        <button
          className="mt-6 min-h-12 rounded-2xl bg-[#6c8bea] px-6 font-black text-white"
          onClick={reset}
          type="button"
        >
          重新尝试
        </button>
      </section>
    </main>
  );
}
