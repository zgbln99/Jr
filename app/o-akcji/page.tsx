import type { Metadata } from "next";
import Link from "next/link";
import {
  getAllSettings,
  listGuests,
  listMedia,
} from "@/lib/db";
import { Navbar } from "@/components/Navbar";
import { About } from "@/components/About";
import { Initiators } from "@/components/Initiators";
import { Foundation } from "@/components/Foundation";
import { Guests } from "@/components/Guests";
import { Media } from "@/components/Media";
import { LiveEmbed } from "@/components/LiveEmbed";
import { HowToHelp } from "@/components/HowToHelp";
import { Footer } from "@/components/Footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "O akcji",
  description:
    "Skąd pomysł na 9-dniową transmisję, kim są inicjatorzy, dokąd trafiają pieniądze, jak pomóc.",
};

const STREAM_URL =
  process.env.STREAM_URL || "https://www.youtube.com/live/UNAqqHIPbWA";

export default function AboutPage() {
  const settings = getAllSettings();
  const guests = listGuests();
  const media = listMedia();

  const donations = [
    { url: settings.donation_url_1, label: settings.donation_label_1 || "Zrzutka 1" },
    { url: settings.donation_url_2, label: settings.donation_label_2 || "Zrzutka 2" },
  ].filter((d) => d.url);

  const primaryDonation = donations[0] ?? null;

  return (
    <>
      <Navbar donationUrl={primaryDonation?.url} />
      <main>
        {/* Tiny page intro header — replaces the big counter hero on /. */}
        <section className="bg-vf-charcoal text-white">
          <div className="max-w-[1440px] mx-auto px-5 md:px-8 pt-32 pb-16 md:pt-40 md:pb-24">
            <Link
              href="/"
              className="eyebrow text-white/60 hover:text-white inline-flex items-center gap-2 mb-6"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path
                  d="M9 3L5 7l4 4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Licznik
            </Link>
            <h1
              className="display text-white max-w-[16ch]"
              style={{
                fontSize: "clamp(2.5rem, 7vw, 5.5rem)",
                lineHeight: 0.92,
                letterSpacing: "-0.025em",
              }}
            >
              O akcji.
            </h1>
            <p className="mt-6 text-white/75 text-[18px] md:text-[20px] leading-relaxed max-w-2xl">
              Skąd pomysł na dziewięć dni, kto to prowadzi, dokąd trafiają
              pieniądze i kto jeszcze dołączy do streamu.
            </p>
          </div>
        </section>

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
        <Media items={media} />
        <LiveEmbed streamUrl={STREAM_URL} />
        <HowToHelp donations={donations} />
      </main>
      <Footer foundationUrl={settings.foundation_url || undefined} />
    </>
  );
}
