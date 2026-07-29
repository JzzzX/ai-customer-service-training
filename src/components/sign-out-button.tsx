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
        className="rounded-xl border-2 border-[#dce8df] bg-white px-4 py-2 text-sm font-bold text-[#4d6758]"
        type="submit"
      >
        退出登录
      </button>
    </form>
  );
}
