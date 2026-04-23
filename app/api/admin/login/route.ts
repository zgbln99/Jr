import { NextResponse } from "next/server";
import { getSession, verifyCredentials } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };
  const username = (body.username || "").trim();
  const password = body.password || "";

  if (!verifyCredentials(username, password)) {
    return NextResponse.json({ error: "Błędne dane logowania" }, { status: 401 });
  }

  const session = await getSession();
  session.isAdmin = true;
  session.username = username;
  await session.save();

  return NextResponse.json({ ok: true });
}
