import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createMedia, listMedia } from "@/lib/db";

type Payload = {
  title?: string;
  outlet?: string;
  url?: string;
  image_url?: string;
  published_at?: string;
  sort_order?: number | string;
};

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(listMedia());
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Payload;
  const title = (body.title || "").trim();
  const outlet = (body.outlet || "").trim();
  const url = (body.url || "").trim();
  if (!title || !outlet || !url) {
    return NextResponse.json(
      { error: "Tytuł, redakcja i link są wymagane" },
      { status: 400 },
    );
  }
  const sort =
    typeof body.sort_order === "string"
      ? Number.parseInt(body.sort_order, 10) || 0
      : body.sort_order ?? 0;
  const mention = createMedia({
    title,
    outlet,
    url,
    image_url: body.image_url?.trim() || null,
    published_at: body.published_at?.trim() || null,
    sort_order: sort,
  });
  return NextResponse.json(mention, { status: 201 });
}
