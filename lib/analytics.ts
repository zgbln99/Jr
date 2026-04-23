import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { insertPageView } from "./db";

// First-party analytics: one row per SSR render of a public page. IP is
// hashed with a daily-rotating salt so we can count uniques without
// persisting raw IPs. Best-effort: failures never throw up into the
// caller's render path — analytics should never break the site.
export function logPageView(path: string) {
  try {
    const h = headers();
    // Respect typical proxy headers — Cloudflare forwards via
    // cf-connecting-ip, nginx via x-forwarded-for.
    const ip =
      h.get("cf-connecting-ip") ||
      h.get("x-real-ip") ||
      h.get("x-forwarded-for")?.split(",")[0].trim() ||
      "0.0.0.0";
    const referrer = (h.get("referer") || "").slice(0, 500);
    const userAgent = (h.get("user-agent") || "").slice(0, 400);

    const salt = process.env.SESSION_SECRET || "jrjr-fallback";
    const today = new Date().toISOString().slice(0, 10);
    const ipHash = createHash("sha256")
      .update(`${salt}:${today}:${ip}`)
      .digest("hex")
      .slice(0, 16);

    insertPageView({
      path,
      referrer: referrer || null,
      userAgent: userAgent || null,
      ipHash,
    });
  } catch (err) {
    console.error("[analytics] failed to log:", err);
  }
}
