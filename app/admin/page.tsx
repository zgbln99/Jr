import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  getAllSettings,
  getLatestCounter,
  getLatestOcrCounter,
  hourlyTimeline,
  listRegions,
  pathBreakdown,
  recentPageViews,
  statsSince,
  topReferrers,
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

  // Analytics — computed on each admin render (page is force-dynamic).
  const now = Date.now();
  const DAY = 24 * 3600_000;
  const stats = {
    today: statsSince(now - DAY),
    week: statsSince(now - 7 * DAY),
    allTime: statsSince(0),
    byPath: pathBreakdown(now - 7 * DAY),
    referrers: topReferrers(now - 7 * DAY),
    timeline: hourlyTimeline(24),
    recent: recentPageViews(30),
  };

  return (
    <AdminDashboard
      settings={settings}
      regions={regions}
      latest={latest}
      latestOcr={latestOcr}
      stats={stats}
    />
  );
}
