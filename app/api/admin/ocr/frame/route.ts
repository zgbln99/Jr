import { NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import { requireAdmin } from "@/lib/auth";
import { captureFrame, LAST_FRAME_PATH } from "@/lib/stream-frame";

export const dynamic = "force-dynamic";

// Serve the most recent frame the worker (or this endpoint) captured.
// When ?t=<ms> is present we honor it for cache-busting from the admin UI.
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const info = await stat(LAST_FRAME_PATH);
    const buf = await readFile(LAST_FRAME_PATH);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(info.size),
        "Cache-Control": "no-store",
        "X-Frame-Mtime": String(info.mtimeMs),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Brak klatki — odpal POST na tym endpoincie albo zaczekaj na pierwszy tick workera." },
      { status: 404 },
    );
  }
}

// Trigger a fresh capture from the live stream.
export async function POST() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await captureFrame();
    const info = await stat(LAST_FRAME_PATH);
    return NextResponse.json({
      ok: true,
      path: LAST_FRAME_PATH,
      mtime: info.mtimeMs,
      size: info.size,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
