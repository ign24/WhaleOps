import { AuthError } from "next-auth";
import Image from "next/image";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";

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
    <main className="relative flex min-h-dvh items-center justify-center p-6" style={{ position: "relative", zIndex: 1 }}>
      <section className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_86%,transparent)] p-8 shadow-[0_14px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:shadow-[0_18px_42px_rgba(0,0,0,0.45)]">
        <div className="mb-6 flex justify-center">
          <Image
            src="/logo.svg"
            alt="CGN-Agent"
            width={240}
            height={68}
            className="logo-light h-16 w-auto"
            priority
          />
          <Image
            src="/logo-dark.svg"
            alt="CGN-Agent"
            width={240}
            height={68}
            className="logo-dark h-16 w-auto"
            priority
          />
        </div>
        <h1 className="text-center text-3xl font-bold tracking-tight">CGN-Agent</h1>
        <p className="mb-6 text-center text-sm text-muted">por CGN Labs</p>

        <form className="space-y-4" action={loginAction}>
          <label className="grid gap-2">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] px-3 py-2 outline-none transition-colors focus-visible:border-[color-mix(in_srgb,var(--primary)_45%,var(--border)_55%)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_22%,transparent)]"
              placeholder="usuario@ejemplo.com"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">Password</span>
            <input
              type="password"
              name="password"
              required
              className="w-full rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] px-3 py-2 outline-none transition-colors focus-visible:border-[color-mix(in_srgb,var(--primary)_45%,var(--border)_55%)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_22%,transparent)]"
              placeholder="********"
            />
          </label>

          {params.error ? <p className="text-sm text-[var(--error)]">{params.error}</p> : null}

          <button type="submit" className="styled-button styled-button-full">
            Ingresar
          </button>
        </form>
      </section>
    </main>
  );
}
