import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteRegion, updateRegion } from "@/lib/db";

type RouteCtx = { params: { id: string } };

function clamp01(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = Number.parseInt(params.id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if ("name" in body) {
    patch.name = typeof body.name === "string" ? body.name.trim() || null : null;
  }
  for (const key of ["x", "y", "width", "height"] as const) {
    if (key in body) patch[key] = clamp01(body[key]);
  }
  if ("enabled" in body) patch.enabled = body.enabled ? 1 : 0;
  if ("sort_order" in body) {
    patch.sort_order = Number.isFinite(Number(body.sort_order))
      ? Number(body.sort_order)
      : 0;
  }
  const updated = updateRegion(id, patch as never);
  if (!updated) {
    return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = Number.parseInt(params.id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }
  deleteRegion(id);
  return NextResponse.json({ ok: true });
}
