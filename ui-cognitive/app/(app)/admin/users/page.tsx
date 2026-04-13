import dynamic from "next/dynamic";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

const UsersAdminPanel = dynamic(
  () => import("@/components/admin/users-admin-panel").then((module) => module.UsersAdminPanel),
  {
    loading: () => <div className="neu-raised h-40 animate-pulse" />,
  },
);

export default async function AdminUsersPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/chat/main");
  }

  return <UsersAdminPanel />;
}
