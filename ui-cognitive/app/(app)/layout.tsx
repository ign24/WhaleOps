import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Header } from "@/components/layout/header";
import { SidebarShell } from "@/components/layout/sidebar-shell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--surface)] focus:px-3 focus:py-2"
      >
        Ir al contenido principal
      </a>
      <main
        className="relative h-dvh min-h-dvh min-w-[320px]"
        id="main-content"
        style={{ position: "relative", zIndex: 1 }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40">
          <div className="pointer-events-auto">
            <Header
              name={session.user.name ?? "Equipo"}
              email={session.user.email ?? ""}
              isAdmin={session.user.role === "admin"}
            />
          </div>
        </div>

        <div className="h-full min-h-0 overflow-hidden pt-14">
          <div className="h-full min-h-0 overflow-hidden">
            <SidebarShell isAdmin={session.user.role === "admin"}>{children}</SidebarShell>
          </div>
        </div>
      </main>
    </>
  );
}
