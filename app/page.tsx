import {
  getAllSettings,
  getLatestCounter,
  listGuests,
} from "@/lib/db";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { About } from "@/components/About";
import { Initiators } from "@/components/Initiators";
import { Foundation } from "@/components/Foundation";
import { Guests } from "@/components/Guests";
import { LiveEmbed } from "@/components/LiveEmbed";
import { HowToHelp } from "@/components/HowToHelp";
import { Footer } from "@/components/Footer";

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
    return null;
  } catch {
    return null;
  }
}

export default function Home() {
  const settings = getAllSettings();
  const counterRow = getLatestCounter();
  const guests = listGuests();

  const counter = {
    amount: counterRow?.amount_pln ?? 0,
    source: (counterRow?.source ?? "manual") as "ocr" | "manual",
    updatedAt: counterRow?.created_at ?? null,
  };

  const donations = [
    { url: settings.donation_url_1, label: settings.donation_label_1 || "Zrzutka 1" },
    { url: settings.donation_url_2, label: settings.donation_label_2 || "Zrzutka 2" },
  ].filter((d) => d.url);

  const primaryDonation = donations[0] ?? null;
  const videoId = extractYoutubeId(STREAM_URL);
  const thumbnail = videoId
    ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
    : "https://i.ytimg.com/vi/UNAqqHIPbWA/maxresdefault.jpg";

  return (
    <>
      <Navbar donationUrl={primaryDonation?.url} />
      <main>
        <Hero
          thumbnailUrl={thumbnail}
          streamUrl={STREAM_URL}
          donation={primaryDonation}
          counter={counter}
          countdownEnd={settings.stream_end_iso || null}
        />
        <About text={settings.about_text} />
        <Initiators
          text={settings.initiators_text}
          latwogangIg={settings.latwogang_ig || undefined}
          bedoesIg={settings.bedoes_ig || undefined}
        />
        <Foundation
          text={settings.foundation_text}
          url={settings.foundation_url || undefined}
          instagram={settings.cancerfighters_ig || undefined}
        />
        <Guests guests={guests} />
        <LiveEmbed streamUrl={STREAM_URL} />
        <HowToHelp donations={donations} />
      </main>
      <Footer foundationUrl={settings.foundation_url || undefined} />
    </>
  );
}
