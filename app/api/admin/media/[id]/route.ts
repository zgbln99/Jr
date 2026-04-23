import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteMedia, updateMedia } from "@/lib/db";

type RouteCtx = { params: { id: string } };

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
  for (const key of [
    "title",
    "outlet",
    "url",
    "image_url",
    "published_at",
    "sort_order",
  ]) {
    if (key in body) {
      const raw = body[key];
      if (key === "sort_order") {
        patch[key] =
          typeof raw === "string" ? Number.parseInt(raw, 10) || 0 : (raw as number) ?? 0;
      } else {
        patch[key] = typeof raw === "string" ? raw.trim() || null : null;
      }
    }
  }
  const updated = updateMedia(id, patch as never);
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
  deleteMedia(id);
  return NextResponse.json({ ok: true });
}
