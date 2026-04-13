import { redirect } from "next/navigation";

export default function AppIndexPage() {
  redirect("/chat/main");
}
