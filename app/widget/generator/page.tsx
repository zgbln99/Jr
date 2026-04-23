import type { Metadata } from "next";
import { headers } from "next/headers";
import { logPageView } from "@/lib/analytics";
import { WidgetGenerator } from "@/components/WidgetGenerator";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Generator widgetu OBS",
  description:
    "Skonfiguruj wygląd licznika do OBS — tło, kolory, cień, skala. Skopiuj URL i wklej jako Browser Source.",
  robots: { index: false, follow: false },
};

export default function WidgetGeneratorPage() {
  logPageView("/widget/generator");
  // Build the absolute URL using the request's Host header so the copy-
  // button value matches the domain the admin is actually visiting
  // (http://<ip>:8010 during setup, https://jrjr.pl in production).
  const h = headers();
  const host = h.get("host") || "jrjr.pl";
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  return <WidgetGenerator origin={origin} />;
}
