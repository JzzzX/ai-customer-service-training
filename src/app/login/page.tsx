import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="w-full max-w-md rounded-[var(--radius-card)] border-2 border-brand-border bg-surface p-7 shadow-[var(--shadow-card)] sm:p-9">
        <LoginForm />

        <p className="mt-6 text-center text-sm text-ink-faint">
          仅限已分配的培训账号登录
        </p>
      </section>
    </main>
  );
}
