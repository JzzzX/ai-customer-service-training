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
        className="rounded-[var(--radius-control)] px-4 py-2 text-sm font-bold text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
        type="submit"
      >
        退出登录
      </button>
    </form>
  );
}
