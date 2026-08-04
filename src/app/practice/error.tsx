"use client";

import { useEffect } from "react";

import { ErrorPanel } from "@/components/error-panel";
import { reportRuntimeError } from "@/lib/runtime/errors";

export default function PracticeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportRuntimeError({ route: "/practice" }, error);
  }, [error]);
  return (
    <ErrorPanel
      message="提交未保存，请检查网络后重试。"
      reset={reset}
    />
  );
}
