import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { OpsDashboard } from "@/components/ops/ops-dashboard";

export default async function OpsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <section className="chat-scrollbar h-full min-h-0 overflow-y-auto">
      <OpsDashboard />
    </section>
  );
}
