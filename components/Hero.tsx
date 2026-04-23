import Image from "next/image";
import Link from "next/link";
import { Counter } from "./Counter";
import { Countdown } from "./Countdown";

type HeroProps = {
  thumbnailUrl: string;
  streamUrl: string;
  donation: { url: string; label: string } | null;
  counter: { amount: number; source: "ocr" | "manual"; updatedAt: number | null };
  countdownEnd: string | null;
};

export function Hero({
  thumbnailUrl,
  streamUrl,
  donation,
  counter,
  countdownEnd,
}: HeroProps) {
  return (
    <section className="relative isolate overflow-hidden bg-vf-charcoal">
      {/* Documentary bg image + darkening vignette */}
      <div className="absolute inset-0 -z-10">
        <Image
          src={thumbnailUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/65 to-vf-charcoal" />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      <div className="max-w-[1440px] mx-auto px-5 md:px-8 pt-24 pb-16 md:pt-32 md:pb-20 min-h-screen flex flex-col items-center justify-center text-center">
        {/* Top row — LIVE tag + brand line + countdown */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-vf-red text-white text-[11px] font-bold uppercase tracking-[0.14em]">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            Na żywo
          </span>
          <span className="eyebrow text-white/70">
            Łatwogang × Bedoes × Cancer Fighters
          </span>
          {countdownEnd ? <Countdown endsAt={countdownEnd} /> : null}
        </div>

        {/* Monumental headline, smaller than before so counter dominates */}
        <h1
          className="display text-white max-w-[18ch] mb-10 md:mb-14"
          style={{
            fontSize: "clamp(2.5rem, 7vw, 5.5rem)",
            lineHeight: 0.92,
            letterSpacing: "-0.025em",
          }}
        >
          Dziewięć dni.{" "}
          <span className="text-vf-red">Jeden cel.</span>
        </h1>

        {/* FOCAL POINT — huge centered counter */}
        <div className="w-full max-w-5xl">
          <p className="eyebrow text-white/60 mb-4 md:mb-6">
            Zebrano dotychczas
          </p>
          <Counter initial={counter} />
        </div>

        {/* CTA pair — center-aligned */}
        <div className="mt-12 md:mt-16 flex flex-wrap items-center justify-center gap-4">
          {donation ? (
            <a
              href={donation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pill"
            >
              Wpłać — {donation.label}
            </a>
          ) : null}
          <Link href="/o-akcji" className="btn-pill-ghost">
            Dowiedz się więcej
            <svg
              aria-hidden
              className="ml-2"
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
            >
              <path
                d="M5 3l4 4-4 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>

        {/* Secondary utility links + reassurance */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-white/70 text-[13px]">
          <span className="flex items-center gap-2">
            <svg
              aria-hidden
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              className="text-vf-red shrink-0"
            >
              <path
                d="M3 8.5l3 3 7-7"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>
              <strong className="text-white font-semibold">100% bez prowizji.</strong>
            </span>
          </span>
          <span className="hidden sm:inline text-white/30">·</span>
          <a
            href={streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-white/30 underline-offset-4 hover:text-white hover:decoration-white transition-colors"
          >
            Oglądaj live na YouTube ↗
          </a>
        </div>
      </div>
    </section>
  );
}
