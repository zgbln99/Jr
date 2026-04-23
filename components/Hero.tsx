import Image from "next/image";
import { Counter } from "./Counter";
import { Countdown } from "./Countdown";

type Donation = { url: string; label: string };

type HeroProps = {
  thumbnailUrl: string;
  streamUrl: string;
  donations: Donation[];
  counter: { amount: number; source: "ocr" | "manual"; updatedAt: number | null };
  countdownEnd: string | null;
};

export function Hero({
  thumbnailUrl,
  streamUrl,
  donations,
  counter,
  countdownEnd,
}: HeroProps) {
  return (
    <section className="relative isolate overflow-hidden bg-vf-charcoal min-h-screen">
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

      <div className="max-w-[1440px] mx-auto px-5 md:px-8 py-16 min-h-screen flex flex-col items-center justify-center text-center">
        {/* Top row — LIVE tag + brand line + countdown */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10 md:mb-14">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-vf-red text-white text-[11px] font-bold uppercase tracking-[0.14em]">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            Na żywo
          </span>
          <span className="eyebrow text-white/70">
            Łatwogang × Bedoes × Cancer Fighters
          </span>
          {countdownEnd ? <Countdown endsAt={countdownEnd} /> : null}
        </div>

        {/* FOCAL POINT — huge centered counter */}
        <div className="w-full max-w-5xl">
          <p className="eyebrow text-white/60 mb-4 md:mb-6">
            Zebrano dotychczas
          </p>
          <Counter initial={counter} />
        </div>

        {/* Donation CTAs — two huge buttons */}
        <div className="mt-14 md:mt-20 flex flex-wrap items-center justify-center gap-4">
          {donations.length === 0 ? (
            <p className="text-white/60 text-[14px]">
              Linki do zrzutek zostaną wkrótce dodane.
            </p>
          ) : (
            donations.map((d) => (
              <a
                key={d.url}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-pill"
              >
                Wpłać — {d.label}
              </a>
            ))
          )}
        </div>

        {/* Reassurance + disclaimer + live link — tiny bottom line */}
        <div className="mt-12 flex flex-col items-center gap-3 text-white/70 text-[13px]">
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
              {" "}Każda złotówka trafia do Fundacji Cancer Fighters.
            </span>
          </span>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <a
              href={streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-white/30 underline-offset-4 hover:text-white hover:decoration-white transition-colors"
            >
              Oglądaj live na YouTube ↗
            </a>
            <span className="text-white/25" aria-hidden>·</span>
            <a
              href="/widget/generator"
              className="underline decoration-white/30 underline-offset-4 hover:text-white hover:decoration-white transition-colors"
            >
              Widget do OBS dla streamerów
            </a>
          </div>
          <p className="text-white/40 text-[11px] uppercase tracking-[0.12em] mt-2">
            Strona fanowska · nieoficjalna
          </p>
        </div>
      </div>
    </section>
  );
}
