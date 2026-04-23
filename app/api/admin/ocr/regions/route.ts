import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createRegion, listRegions, type OcrRegion } from "@/lib/db";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(listRegions());
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<OcrRegion>;
  const x = clamp01(Number(body.x));
  const y = clamp01(Number(body.y));
  const width = clamp01(Number(body.width));
  const height = clamp01(Number(body.height));
  if (width <= 0 || height <= 0) {
    return NextResponse.json(
      { error: "Szerokość i wysokość obszaru muszą być > 0" },
      { status: 400 },
    );
  }
  const region = createRegion({
    name: (body.name ?? null) as string | null,
    x,
    y,
    width,
    height,
    enabled: body.enabled === 0 ? 0 : 1,
    sort_order: Number.isFinite(body.sort_order) ? Number(body.sort_order) : 0,
  });
  return NextResponse.json(region, { status: 201 });
}
