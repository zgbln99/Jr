import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getLatestCounter, insertCounter } from "@/lib/db";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(getLatestCounter());
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    amount?: number | string;
    note?: string;
  };
  const amount = typeof body.amount === "string" ? Number(body.amount) : body.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "Nieprawidłowa kwota" }, { status: 400 });
  }
  const row = insertCounter(amount, "manual", body.note?.toString().slice(0, 500));
  return NextResponse.json(row);
}
