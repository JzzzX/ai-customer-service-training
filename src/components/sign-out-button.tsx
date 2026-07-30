import { signOut } from "@/auth";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button
        className="rounded-[var(--radius-control)] border-2 border-brand-border bg-surface px-4 py-2 text-sm font-bold text-ink-soft"
        type="submit"
      >
        退出登录
      </button>
    </form>
  );
}
