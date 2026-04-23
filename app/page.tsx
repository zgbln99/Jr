import { getAllSettings, getLatestCounter } from "@/lib/db";
import { Hero } from "@/components/Hero";

export const dynamic = "force-dynamic";

const STREAM_URL =
  process.env.STREAM_URL || "https://www.youtube.com/live/UNAqqHIPbWA";

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("youtu.be")) return u.pathname.slice(1);
    const parts = u.pathname.split("/").filter(Boolean);
    const liveIdx = parts.indexOf("live");
    if (liveIdx >= 0 && parts[liveIdx + 1]) return parts[liveIdx + 1];
    const v = u.searchParams.get("v");
    if (v) return v;
  } catch {}
  return null;
}

export default function Home() {
  const settings = getAllSettings();
  const counterRow = getLatestCounter();

  const counter = {
    amount: counterRow?.amount_pln ?? 0,
    source: (counterRow?.source ?? "manual") as "ocr" | "manual",
    updatedAt: counterRow?.created_at ?? null,
  };

  const donations = [
    {
      url: settings.donation_url_1,
      label: settings.donation_label_1 || "Tipply",
    },
    {
      url: settings.donation_url_2,
      label: settings.donation_label_2 || "Siepomaga",
    },
  ].filter((d) => d.url);

  const videoId = extractYoutubeId(STREAM_URL);
  const thumbnail = videoId
    ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
    : "https://i.ytimg.com/vi/UNAqqHIPbWA/maxresdefault.jpg";

  return (
    <Hero
      thumbnailUrl={thumbnail}
      streamUrl={STREAM_URL}
      donations={donations}
      counter={counter}
      countdownEnd={settings.stream_end_iso || null}
    />
  );
}
