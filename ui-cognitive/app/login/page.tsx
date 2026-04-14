import { AuthError } from "next-auth";
import Image from "next/image";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import { ThemeToggle } from "@/components/layout/theme-toggle";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  if (session?.user) {
    redirect("/chat/main");
  }

  const params = await searchParams;
  const loginAction = async (formData: FormData) => {
    "use server";

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      await signIn("credentials", { email, password, redirectTo: "/chat/main" });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect("/login?error=Credenciales%20inv%C3%A1lidas");
      }

      throw error;
    }
  };

  return (
    <main className="relative z-[1] flex min-h-dvh items-center justify-center px-6 py-10">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <section className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] p-8 shadow-[0_2px_8px_rgba(15,23,42,0.06)] backdrop-blur-md dark:shadow-[0_2px_8px_rgba(0,0,0,0.22)]">
        <div className="mb-6 flex justify-center">
          <Image
            src="/logo-whale.png"
            alt="WhaleOps"
            width={72}
            height={72}
            className="h-[72px] w-[72px]"
            priority
          />
        </div>
        <h1 className="text-center text-3xl font-bold tracking-tight leading-[1.05]">WhaleOps</h1>
        <p className="mb-6 text-center text-sm text-muted">por CGNLabs</p>

        <form className="space-y-4" action={loginAction}>
          <label className="grid gap-2">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-3 py-2 outline-none transition-colors placeholder:text-muted focus-visible:border-[color-mix(in_srgb,var(--primary)_45%,var(--border)_55%)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_22%,transparent)]"
              placeholder="usuario@ejemplo.com"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">Password</span>
            <input
              type="password"
              name="password"
              required
              className="w-full rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-3 py-2 outline-none transition-colors placeholder:text-muted focus-visible:border-[color-mix(in_srgb,var(--primary)_45%,var(--border)_55%)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_22%,transparent)]"
              placeholder="********"
            />
          </label>

          {params.error ? <p className="text-sm text-[var(--error)]">{params.error}</p> : null}

          <button type="submit" className="styled-button styled-button-full login-submit-button">
            Ingresar
          </button>
        </form>
      </section>
    </main>
  );
}
