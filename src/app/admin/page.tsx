import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { liveSession } from "@/lib/guard";

export const metadata: Metadata = {
  title: "Backoffice du vote Halloween",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const role = (await liveSession())?.role;
  if (!role) redirect("/admin/login");
  return <AdminDashboard role={role} />;
}
