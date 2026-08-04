"use client";

import { useEffect } from "react";

import { ErrorPanel } from "@/components/error-panel";
import { reportRuntimeError } from "@/lib/runtime/errors";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportRuntimeError({ route: "/admin" }, error);
  }, [error]);
  return (
    <ErrorPanel
      message="这条记录不存在或你没有访问权限。"
      reset={reset}
    />
  );
}
