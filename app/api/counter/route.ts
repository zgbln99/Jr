import { NextResponse } from "next/server";
import { getLatestCounter } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const row = getLatestCounter();
  return NextResponse.json(
    {
      amount: row?.amount_pln ?? 0,
      source: row?.source ?? "manual",
      updatedAt: row?.created_at ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
