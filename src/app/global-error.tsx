"use client";

import { useEffect } from "react";

import { reportRuntimeError } from "@/lib/runtime/errors";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportRuntimeError({ route: "global" }, error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body>
        <main>
          <h1>服务暂时不可用，请稍后重试。</h1>
          <button onClick={reset} type="button">
            重新尝试
          </button>
        </main>
      </body>
    </html>
  );
}
