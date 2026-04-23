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

  // Two-sided guard, same as /api/internal/frame — block both decreases
  // and implausible >+50% jumps so an inflated misread can't lock the
  // counter at a fake high value.
  const latest = getLatestCounter();
  if (latest && latest.amount_pln >= 10_000) {
    if (body.amount < latest.amount_pln) {
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
    if (body.amount / latest.amount_pln > 1.5) {
      console.warn(
        `[ocr] rejecting implausible spike: ${body.amount.toFixed(0)} > 1.5× last ${latest.amount_pln.toFixed(0)}`,
      );
      return NextResponse.json({
        saved: false,
        rejected: "implausible upward jump",
        attempted: body.amount,
        previousAmount: latest.amount_pln,
      });
    }
  }

  const row = insertCounter(body.amount, "ocr", body.note?.slice(0, 500));
  return NextResponse.json(row);
}
