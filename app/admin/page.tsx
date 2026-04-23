import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getAllSettings, getLatestCounter, getLatestOcrCounter, listGuests } from "@/lib/db";
import { AdminDashboard } from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireAdmin();
  if (!session) {
    redirect("/admin/login");
  }

  const settings = getAllSettings();
  const guests = listGuests();
  const latest = getLatestCounter();
  const latestOcr = getLatestOcrCounter();

  return (
    <AdminDashboard
      settings={settings}
      guests={guests}
      latest={latest}
      latestOcr={latestOcr}
    />
  );
}
