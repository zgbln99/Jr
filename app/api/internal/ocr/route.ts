import { NextResponse } from "next/server";
import { getLatestCounter, insertCounter } from "@/lib/db";

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

  // Same monotonic guard as /api/internal/frame: OCR reads only add to
  // the public counter, never take away. Admin's manual overrides still
  // set the floor (manual reads are inserted with source='manual').
  const latest = getLatestCounter();
  if (latest && body.amount < latest.amount_pln) {
    console.warn(
      `[ocr] rejecting decreasing sum: ${body.amount.toFixed(0)} < last ${latest.amount_pln.toFixed(0)}`,
    );
    return NextResponse.json({
      saved: false,
      rejected: "sum lower than last",
      attempted: body.amount,
      previousAmount: latest.amount_pln,
    });
  }

  const row = insertCounter(body.amount, "ocr", body.note?.slice(0, 500));
  return NextResponse.json(row);
}
