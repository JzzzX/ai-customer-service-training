import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10 animate-fade-in-up">
      <section className="w-full max-w-md rounded-[var(--radius-card)] bg-gradient-to-br from-surface to-surface-muted p-7 shadow-[var(--shadow-soft)] sm:p-9">
        <LoginForm />

        <p className="mt-6 text-center text-sm text-ink-faint">
          仅限已分配的培训账号登录
        </p>
      </section>
    </main>
  );
}
