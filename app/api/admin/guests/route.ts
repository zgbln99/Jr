import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createGuest, listGuests } from "@/lib/db";

type Payload = {
  name?: string;
  handle?: string;
  instagram?: string;
  appearance_date?: string;
  status?: string;
  photo_url?: string;
  sort_order?: number | string;
};

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(listGuests());
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Payload;
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Imię/nazwa jest wymagane" }, { status: 400 });
  }
  const status = body.status === "upcoming" ? "upcoming" : "past";
  const sort =
    typeof body.sort_order === "string"
      ? Number.parseInt(body.sort_order, 10) || 0
      : body.sort_order ?? 0;
  const guest = createGuest({
    name,
    handle: body.handle?.trim() || null,
    instagram: body.instagram?.trim() || null,
    appearance_date: body.appearance_date?.trim() || null,
    status,
    photo_url: body.photo_url?.trim() || null,
    sort_order: sort,
  });
  return NextResponse.json(guest, { status: 201 });
}
