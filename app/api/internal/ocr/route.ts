import { NextResponse } from "next/server";
import { insertCounter } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = req.headers.get("x-internal-token");
  const expected = process.env.SESSION_SECRET;
  if (!expected || !token || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    amount?: number;
    note?: string;
  };
  if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount < 0) {
    return NextResponse.json({ error: "Bad amount" }, { status: 400 });
  }
  const row = insertCounter(body.amount, "ocr", body.note?.slice(0, 500));
  return NextResponse.json(row);
}
