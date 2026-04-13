import { auth } from "@/auth";
import { ObservabilityDashboardView } from "@/components/observability/dashboard-view";
import { redirect } from "next/navigation";

export default async function ObservabilityPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <ObservabilityDashboardView />;
}
