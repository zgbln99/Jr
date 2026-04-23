import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAllSettings, setSetting } from "@/lib/db";

const ALLOWED_KEYS = new Set([
  "donation_url_1",
  "donation_url_2",
  "donation_label_1",
  "donation_label_2",
  "stream_end_iso",
  "about_text",
  "initiators_text",
  "foundation_text",
  "foundation_url",
  "latwogang_ig",
  "bedoes_ig",
  "cancerfighters_ig",
]);

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(getAllSettings());
}

export async function PUT(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (typeof value !== "string") continue;
    updates[key] = value;
    setSetting(key, value);
  }
  return NextResponse.json({ ok: true, updated: Object.keys(updates) });
}
