"use client";

import { useEffect } from "react";

import { ErrorPanel } from "@/components/error-panel";
import { reportRuntimeError } from "@/lib/runtime/errors";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportRuntimeError({ route: "root" }, error);
  }, [error]);

  return (
    <ErrorPanel
      message="服务暂时不可用，请稍后重试。"
      reset={reset}
    />
  );
}
