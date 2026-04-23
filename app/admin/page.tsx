import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  getAllSettings,
  getLatestCounter,
  getLatestOcrCounter,
  listRegions,
} from "@/lib/db";
import { AdminDashboard } from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireAdmin();
  if (!session) {
    redirect("/admin/login");
  }

  const settings = getAllSettings();
  const regions = listRegions();
  const latest = getLatestCounter();
  const latestOcr = getLatestOcrCounter();

  return (
    <AdminDashboard
      settings={settings}
      regions={regions}
      latest={latest}
      latestOcr={latestOcr}
    />
  );
}
